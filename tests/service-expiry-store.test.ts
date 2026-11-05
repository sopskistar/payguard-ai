import { beforeAll, beforeEach, afterAll, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { PGlite } from '@electric-sql/pglite';
import { Transaction } from '@mysten/sui/transactions';
import { eq, and } from 'drizzle-orm';
const mock = vi.hoisted(() => ({
  evidence: vi.fn(),
  scope: [] as import('@/lib/approved-service-recoveries').ApprovedServiceRecovery[],
}));
vi.mock('@/lib/integrations/service-expiry', () => ({ readServiceExpiryEvidence: mock.evidence }));
vi.mock('@/lib/approved-service-recoveries', () => ({ APPROVED_SERVICE_RECOVERIES: mock.scope }));
import { controlledServiceRecoveryStatus } from '@/lib/controlled-service-recovery';
import { db } from '@/db';
import * as s from '@/db/schema';
import { seedDemo, listInvoices } from '@/lib/store';
import { OWNER_ID } from '@/lib/demo';
import { DEFAULT_PREFERENCES } from '@/lib/types';
import { MAINNET_GENESIS, type ServiceChallenge } from '@/lib/service-protocol';
import {
  EXPIRY_RULES,
  type ServiceExpiryWindow,
  type ServiceExpiryEvidence,
} from '@/lib/service-expiry';
import {
  recoverExpiredService,
  ownedService,
  serviceRecoveryHolds,
  fulfillService,
} from '@/lib/service-payments';
let directory: string;
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
const pilotId = hash('payguard:public-sponsored-pilot:v1:sui:mainnet');
const address = '0x' + '1'.repeat(64),
  merchant = '0x' + '2'.repeat(64),
  sponsor = '0x' + '3'.repeat(64);
let memberId: string, invoiceId: string, walletBudget: string;
const evidence = (window: ServiceExpiryWindow): ServiceExpiryEvidence[] =>
  (['tatum', 'sui-fullnode'] as const).map((provider) => ({
    provider,
    digest: window.digest,
    checkedAt: new Date().toISOString(),
    genesis: MAINNET_GENESIS,
    epoch: '1302',
    protocolVersion: EXPIRY_RULES.protocolVersion,
    expirationEnabled: true,
    checkpoint: '210',
    lowestCheckpoint: '1',
    firstValidCheckpoint: '100',
    lastValidCheckpoint: '199',
    boundaryDigest: 'SYNTHETIC_BOUNDARY',
    boundaryEpoch: '1301',
    boundaryClosed: true,
    transaction: { outcome: 'not-found' },
  }));
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'payguard-expiry-isolated-'));
  vi.stubEnv('DATABASE_URL', '');
  vi.stubEnv('LOCAL_DATABASE_PATH', directory);
  vi.stubEnv('MEMWAL_PRIVATE_KEY', '');
  vi.stubEnv('MEMWAL_ACCOUNT_ID', '');
  vi.stubEnv('ENABLE_AGENT_PAYMENTS', 'mainnet');
  vi.stubEnv('TATUM_API_KEY', '');
  vi.stubEnv('APP_URL', 'http://localhost:3000');
  vi.stubEnv('SERVICE_EXPIRED_RECOVERY_ENABLED', 'true');
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw Error('No external service is allowed in recovery database tests');
    }),
  );
  await migrate(await db(), { migrationsFolder: 'drizzle' });
  await seedDemo();
  memberId = randomUUID();
  walletBudget = hash(memberId + ':authenticated-wallet-pilot-v1:sui:mainnet');
  await (await db()).insert(s.users).values({
    id: memberId,
    role: 'member',
    walletAddress: address,
    name: 'Disposable recovery customer',
    settings: DEFAULT_PREFERENCES,
  });
  await seedDemo(memberId);
  invoiceId = (await listInvoices(memberId))[0].id;
}, 30000);
beforeEach(async () => {
  // Only this newly-created disposable PGlite. Never loads .env.local or connects to Neon.
  const d = await db();
  await d.delete(s.servicePaymentReceipts);
  await d.delete(s.servicePaymentIntents);
  await d.delete(s.serviceSpendingSessions);
  await d.delete(s.auditEvents);
  vi.stubEnv('SERVICE_EXPIRED_RECOVERY_ENABLED', 'true');
  mock.evidence.mockReset().mockImplementation(async (window) => evidence(window));
  mock.scope.length = 0;
});
afterAll(async () => {
  await ((await db()) as unknown as { $client: PGlite }).$client.close();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await rm(directory, { recursive: true, force: true });
});
async function fixture() {
  const id = randomUUID();
  const challenge: ServiceChallenge = {
    x402Version: 2,
    resource: {
      url: 'http://localhost:3000/api/service-payments/' + id,
      description: 'Disposable recovery fixture',
      mimeType: 'application/json',
    },
    accepts: [
      {
        scheme: 'exact',
        network: 'sui:mainnet',
        asset: '0x2::sui::SUI',
        amount: '1000000',
        payTo: merchant,
        maxTimeoutSeconds: 300,
        extra: {
          gasOwner: sponsor,
          gasBudget: '2000000',
          quoteId: id,
          instructionHash: 'a'.repeat(64),
          authenticatedPayer: address,
        },
      },
    ],
  };
  const tx = new Transaction();
  tx.setSender(address);
  tx.setGasOwner(sponsor);
  tx.setGasBudget(2000000);
  tx.setGasPrice(100);
  tx.setGasPayment([]);
  tx.setExpiration({
    ValidDuring: {
      minEpoch: 1300,
      maxEpoch: 1301,
      minTimestamp: null,
      maxTimestamp: null,
      chain: MAINNET_GENESIS,
      nonce: Math.floor(Math.random() * 0xffffffff),
    },
  });
  const redeemed = tx.moveCall({
    target: '0x2::balance::redeem_funds',
    typeArguments: ['0x2::sui::SUI'],
    arguments: [tx.withdrawal({ type: '0x2::sui::SUI', amount: 1000000n })],
  });
  tx.moveCall({
    target: '0x2::balance::send_funds',
    typeArguments: ['0x2::sui::SUI'],
    arguments: [redeemed, tx.pure.address(merchant)],
  });
  tx.pure.string(id);
  const prepared = {
    bytes: Buffer.from(await tx.build()).toString('base64'),
    digest: await tx.getDigest(),
    preparedAt: new Date().toISOString(),
  };
  const d = await db();
  await d.insert(s.servicePaymentIntents).values({
    id,
    tenantId: memberId,
    invoiceId,
    operationKey: randomUUID(),
    instructionHash: 'a'.repeat(64),
    challenge,
    state: 'approved',
    payer: address,
    approvedAt: new Date(),
    spendingSessionId: walletBudget,
    approval: { prepared },
    expiresAt: new Date(Date.now() - 10000),
  });
  for (const [budgetId, tenantId, payer, capAtomic] of [
    [walletBudget, memberId, address, '3000000'],
    [pilotId, OWNER_ID, 'public-sponsored-pilot-ledger', '20000000'],
  ]) {
    const [budget] = await d
      .select()
      .from(s.serviceSpendingSessions)
      .where(eq(s.serviceSpendingSessions.id, budgetId));
    if (budget)
      await d
        .update(s.serviceSpendingSessions)
        .set({ reservedAtomic: (BigInt(budget.reservedAtomic) + 1000000n).toString() })
        .where(eq(s.serviceSpendingSessions.id, budgetId));
    else
      await d.insert(s.serviceSpendingSessions).values({
        id: budgetId,
        tenantId,
        network: 'sui:mainnet',
        asset: '0x2::sui::SUI',
        payer,
        reservedAtomic: '1000000',
        capAtomic,
      });
  }
  mock.scope.push({
    id,
    role: 'member',
    payer: address,
    digest: prepared.digest,
    amountAtomic: '1000000',
    minEpoch: '1300',
    maxEpoch: '1301',
  });
  return { id, prepared };
}
async function reserved() {
  return (
    await (
      await db()
    )
      .select()
      .from(s.serviceSpendingSessions)
      .orderBy(s.serviceSpendingSessions.id)
  ).map((b) => b.reservedAtomic);
}
async function events(id: string) {
  return (await db()).select().from(s.auditEvents).where(eq(s.auditEvents.entityId, id));
}
it('authenticates ownership and keeps recovery disabled unless explicitly enabled', async () => {
  const f = await fixture(),
    before = await reserved();
  vi.stubEnv('SERVICE_EXPIRED_RECOVERY_ENABLED', '');
  await expect(recoverExpiredService(memberId, f.id)).rejects.toMatchObject({
    code: 'RECOVERY_DISABLED',
  });
  vi.stubEnv('SERVICE_EXPIRED_RECOVERY_ENABLED', 'true');
  await expect(recoverExpiredService(OWNER_ID, f.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  expect(await reserved()).toEqual(before);
  expect(mock.evidence).not.toHaveBeenCalled();
});
it('keeps valid epochs, provider failures, conflicts, discovered executions and missing history reserved with an audit explanation', async () => {
  const f = await fixture(),
    before = await reserved();
  for (const patch of [
    { epoch: '1301' },
    { error: 'UNAVAILABLE' },
    { genesis: 'wrong' },
    { transaction: { outcome: 'found' as const, checkpoint: '150', success: true } },
    { transaction: { outcome: 'found' as const, checkpoint: '150', success: false } },
    { lowestCheckpoint: '101' },
    { boundaryClosed: false },
  ]) {
    mock.evidence.mockImplementation(async (window) => {
      const e = evidence(window);
      Object.assign(e[0], patch);
      return e;
    });
    expect((await recoverExpiredService(memberId, f.id)).recovered).toBe(false);
    expect(await reserved()).toEqual(before);
    expect((await ownedService(memberId, f.id)).state).toBe('approved');
  }
  expect(
    (await events(f.id)).filter((e) => e.type === 'service.expiry_recovery_held'),
  ).toHaveLength(7);
});
it('preserves uncertain wallet history and original bytes/digest while releasing only the proven expired reservation', async () => {
  const a = await fixture();
  await fixture();
  await fixture();
  await (await db()).insert(s.auditEvents).values({
    tenantId: memberId,
    entityId: a.id,
    type: 'service.wallet_error',
    detail: { diagnostic: { code: 'PROVIDER_ERROR' } },
  });
  const result = await recoverExpiredService(memberId, a.id);
  expect(result).toMatchObject({
    recovered: true,
    state: 'expired-unexecuted',
    releasedAtomic: '1000000',
  });
  expect(await reserved()).toEqual(['2000000', '2000000']);
  const row = await ownedService(memberId, a.id);
  expect(row.approval).toEqual({ prepared: a.prepared });
  expect(row.digest).toBeNull();
  expect(row.payloadHash).toBeNull();
  const history = await events(a.id);
  expect(history.some((e) => e.type === 'service.wallet_error')).toBe(true);
  expect(history.find((e) => e.type === 'service.expiry_recovered')?.detail).toMatchObject({
    preparedDigest: a.prepared.digest,
    signaturesMayHaveExisted: true,
    paymentFailureAsserted: false,
  });
  expect(await serviceRecoveryHolds(memberId)).toHaveLength(2);
  expect(await (await db()).select().from(s.servicePaymentReceipts)).toHaveLength(0);
  const before = await reserved();
  expect((await fulfillService(memberId, a.id)).state).toBe('expired-unexecuted');
  expect(await reserved()).toEqual(before);
  expect(fetch).not.toHaveBeenCalled();
});
it('serializes simultaneous recoveries and repeats without a second release or second transition', async () => {
  const f = await fixture();
  const results = await Promise.all([
    recoverExpiredService(memberId, f.id),
    recoverExpiredService(memberId, f.id),
  ]);
  expect(results.map((r) => r.releasedAtomic).sort()).toEqual(['0', '1000000']);
  expect(await reserved()).toEqual(['0', '0']);
  expect((await events(f.id)).filter((e) => e.type === 'service.expiry_recovered')).toHaveLength(1);
  expect((await recoverExpiredService(memberId, f.id)).releasedAtomic).toBe('0');
  expect(mock.evidence).toHaveBeenCalledOnce();
  expect(fetch).not.toHaveBeenCalled();
});
it('preserves submitted evidence, receipts and settled spending rather than freeing a paid reservation', async () => {
  const paid = await fixture(),
    fresh = await fixture();
  const d = await db();
  await d
    .update(s.servicePaymentIntents)
    .set({ state: 'settled', digest: paid.prepared.digest })
    .where(eq(s.servicePaymentIntents.id, paid.id));
  await d.insert(s.servicePaymentReceipts).values({
    tenantId: memberId,
    intentId: paid.id,
    digest: paid.prepared.digest,
    network: 'sui:mainnet',
    evidence: { fixture: true },
    result: { report: 'preserve' },
  });
  expect((await recoverExpiredService(memberId, paid.id)).recovered).toBe(false);
  expect((await recoverExpiredService(memberId, fresh.id)).recovered).toBe(true);
  expect(await reserved()).toEqual(['1000000', '1000000']);
  const next = await fixture(),
    before = await reserved();
  await d
    .update(s.servicePaymentIntents)
    .set({ payloadHash: 'SYNTHETIC_DISCLOSED_HASH' })
    .where(eq(s.servicePaymentIntents.id, next.id));
  expect((await recoverExpiredService(memberId, next.id)).reason).toBe(
    'SUBMISSION_REQUIRES_RECONCILIATION',
  );
  expect(await reserved()).toEqual(before);
  expect(await d.select().from(s.servicePaymentReceipts)).toHaveLength(1);
});
it('does not release an inconsistent liability ledger or a substituted preparation', async () => {
  const f = await fixture(),
    d = await db();
  await d
    .update(s.serviceSpendingSessions)
    .set({ reservedAtomic: '2000000' })
    .where(eq(s.serviceSpendingSessions.id, walletBudget));
  const before = await reserved();
  expect((await recoverExpiredService(memberId, f.id)).reason).toBe('BUDGET_LIABILITY_CONFLICT');
  expect(await reserved()).toEqual(before);
  await d
    .update(s.servicePaymentIntents)
    .set({ approval: { prepared: { ...f.prepared, digest: 'SUBSTITUTED' } } })
    .where(
      and(eq(s.servicePaymentIntents.id, f.id), eq(s.servicePaymentIntents.tenantId, memberId)),
    );
  expect((await recoverExpiredService(memberId, f.id)).reason).toBe('PREPARED_DIGEST_MISMATCH');
  expect(await reserved()).toEqual(before);
});
it('keeps reservations when a later reconciliation discovers a finalized transaction', async () => {
  const f = await fixture(),
    before = await reserved();
  mock.evidence.mockImplementationOnce(async (window) =>
    evidence(window).map((e) => (e.provider === 'tatum' ? { ...e, error: 'UNAVAILABLE' } : e)),
  );
  expect((await recoverExpiredService(memberId, f.id)).recovered).toBe(false);
  mock.evidence.mockImplementationOnce(async (window) =>
    evidence(window).map((e) =>
      e.provider === 'sui-fullnode'
        ? { ...e, transaction: { outcome: 'found', checkpoint: '150', success: true } }
        : e,
    ),
  );
  expect((await recoverExpiredService(memberId, f.id)).reason).toBe('TRANSACTION_FOUND_RECONCILE');
  expect(await reserved()).toEqual(before);
  expect((await ownedService(memberId, f.id)).state).toBe('approved');
});
it('holds unexpected settlement or confirmation audits even without a stored digest or receipt', async () => {
  for (const type of ['service.settlement_requested', 'service.confirmation_uncertain']) {
    const f = await fixture(),
      before = await reserved();
    await (
      await db()
    )
      .insert(s.auditEvents)
      .values({ tenantId: memberId, entityId: f.id, type, detail: { fixture: true } });
    expect((await recoverExpiredService(memberId, f.id)).reason).toBe(
      'SUBMISSION_REQUIRES_RECONCILIATION',
    );
    expect(await reserved()).toEqual(before);
  }
  expect(mock.evidence).not.toHaveBeenCalled();
});
it('serializes recoveries of different intents sharing the same reservation ledgers', async () => {
  const a = await fixture(),
    b = await fixture();
  const results = await Promise.all([
    recoverExpiredService(memberId, a.id),
    recoverExpiredService(memberId, b.id),
  ]);
  expect(results.every((r) => r.recovered && r.releasedAtomic === '1000000')).toBe(true);
  expect(await reserved()).toEqual(['0', '0']);
  expect((await events(a.id)).filter((e) => e.type === 'service.expiry_recovered')).toHaveLength(1);
  expect((await events(b.id)).filter((e) => e.type === 'service.expiry_recovered')).toHaveLength(1);
});
it('exposes the real flag and exact owned originals without provider calls, writes or another workspace records', async () => {
  const a = await fixture(),
    b = await fixture(),
    before = await reserved();
  const result = await controlledServiceRecoveryStatus(memberId);
  expect(result).toMatchObject({
    enabled: true,
    verified: true,
    nextId: a.id,
    wallet: { reservedAtomic: '2000000', liabilityAtomic: '2000000' },
    sponsor: { reservedAtomic: '2000000', liabilityAtomic: '2000000' },
  });
  expect(result.records.map((r) => r.id)).toEqual([a.id, b.id]);
  expect(JSON.stringify(result)).not.toContain(a.prepared.bytes);
  expect((await controlledServiceRecoveryStatus(OWNER_ID)).records).toEqual([]);
  vi.stubEnv('SERVICE_EXPIRED_RECOVERY_ENABLED', 'false');
  expect((await controlledServiceRecoveryStatus(memberId)).enabled).toBe(false);
  expect(await reserved()).toEqual(before);
  expect(mock.evidence).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it('independently verifies one persisted recovery, audit and whole-ledger reduction before selecting the next original', async () => {
  const a = await fixture(),
    b = await fixture();
  await recoverExpiredService(memberId, a.id);
  const result = await controlledServiceRecoveryStatus(memberId);
  expect(result).toMatchObject({
    verified: true,
    nextId: b.id,
    wallet: { reservedAtomic: '1000000' },
    sponsor: { reservedAtomic: '1000000' },
  });
  expect(result.records[0]).toMatchObject({
    state: 'expired-unexecuted',
    recoveredVerified: true,
    releasedAtomic: '1000000',
    digest: a.prepared.digest,
  });
  expect(result.records[0].auditId).toBeTruthy();
  expect(mock.evidence).toHaveBeenCalledOnce();
});
it('blocks the recovery UI on a missing audit field or reserved-liability discrepancy', async () => {
  const a = await fixture();
  await fixture();
  await recoverExpiredService(memberId, a.id);
  const event = (await events(a.id)).find((e) => e.type === 'service.expiry_recovered')!;
  await (
    await db()
  )
    .update(s.auditEvents)
    .set({ detail: { ...(event.detail as object), releasedAtomic: '2000000' } })
    .where(eq(s.auditEvents.id, event.id));
  expect(await controlledServiceRecoveryStatus(memberId)).toMatchObject({
    verified: false,
    nextId: null,
  });
  await (
    await db()
  )
    .update(s.serviceSpendingSessions)
    .set({ reservedAtomic: '7' })
    .where(eq(s.serviceSpendingSessions.id, walletBudget));
  const result = await controlledServiceRecoveryStatus(memberId);
  expect(result.issues).toContain('WALLET_LIABILITY_CONFLICT');
  expect(result.nextId).toBeNull();
});
it('keeps an unsuccessful chain check stopped across read-only refreshes without another recovery attempt', async () => {
  const a = await fixture();
  await fixture();
  mock.evidence.mockImplementation(async (window) =>
    evidence(window).map((e) => ({ ...e, error: 'UNAVAILABLE' })),
  );
  await recoverExpiredService(memberId, a.id);
  for (let i = 0; i < 2; i++)
    expect(await controlledServiceRecoveryStatus(memberId)).toMatchObject({
      verified: false,
      nextId: null,
    });
  expect(mock.evidence).toHaveBeenCalledOnce();
  expect(await reserved()).toEqual(['2000000', '2000000']);
});
it('reports all completed originals with zero reservations and never creates a second audit on refresh', async () => {
  const a = await fixture(),
    b = await fixture(),
    c = await fixture();
  for (const f of [a, b, c]) await recoverExpiredService(memberId, f.id);
  const result = await controlledServiceRecoveryStatus(memberId);
  expect(result).toMatchObject({
    verified: true,
    nextId: null,
    wallet: { reservedAtomic: '0' },
    sponsor: { reservedAtomic: '0' },
  });
  expect(result.records.every((r) => r.recoveredVerified && r.auditId)).toBe(true);
  const ids = result.records.map((r) => r.auditId);
  expect((await controlledServiceRecoveryStatus(memberId)).records.map((r) => r.auditId)).toEqual(
    ids,
  );
  expect(mock.evidence).toHaveBeenCalledTimes(3);
});
it('keeps completed historical audits verified when one later normal purchase reserves funds after flag shutdown', async () => {
  const a = await fixture(),
    b = await fixture(),
    c = await fixture();
  for (const f of [a, b, c]) await recoverExpiredService(memberId, f.id);
  await fixture();
  mock.scope.pop(); // A later normal purchase is outside the four-record approval.
  expect((await controlledServiceRecoveryStatus(memberId)).verified).toBe(false);
  vi.stubEnv('SERVICE_EXPIRED_RECOVERY_ENABLED', 'false');
  const status = await controlledServiceRecoveryStatus(memberId);
  expect(status).toMatchObject({
    enabled: false,
    verified: true,
    nextId: null,
    wallet: { reservedAtomic: '1000000', liabilityAtomic: '1000000' },
  });
  expect(status.records).toHaveLength(3);
  expect(status.records.every((r) => r.recoveredVerified)).toBe(true);
});
