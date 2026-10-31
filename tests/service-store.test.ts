import { beforeAll, beforeEach, afterAll, it, expect, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { PGlite } from '@electric-sql/pglite';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64 } from '@mysten/sui/utils';
const mock = vi.hoisted(() => ({ inspect: vi.fn(), preflight: vi.fn() }));
vi.mock('@/lib/integrations/service-tatum', () => ({
  inspectServiceSettlement: mock.inspect,
  serviceChainPreflight: mock.preflight,
}));
import { db } from '@/db';
import { seedDemo, listInvoices } from '@/lib/store';
import { OWNER_ID } from '@/lib/demo';
import {
  quoteService,
  approveService as approveCore,
  fulfillService as fulfillCore,
  ownedService,
  cancelService,
  rememberService,
  serviceProgress,
  recordServiceWalletEvent,
  serviceExposure,
} from '@/lib/service-payments';
import { serviceNetworkInfo, type ServiceChallenge } from '@/lib/service-protocol';
import { AppError } from '@/lib/errors';
import { assess } from '@/lib/integrations/memory';
import * as memory from '@/lib/integrations/memory';
import * as signatureVerifier from '@/lib/integrations/service-signature';
import { DEFAULT_PREFERENCES } from '@/lib/types';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';
let directory: string;
let settles = 0;
let verifyHook: (() => Promise<Response>) | undefined;
const payer = Ed25519Keypair.generate();
let spendingSession = randomUUID();
beforeEach(() => {
  spendingSession = randomUUID();
  verifyHook = undefined;
});
const approveService = async (tenant: string, id: string, address: string) =>
  approveCore(
    tenant,
    id,
    address,
    spendingSession,
    (await payload(await ownedService(tenant, id))).payload.transaction,
  );
const fulfillService = (tenant: string, id: string, raw?: unknown) =>
  fulfillCore(tenant, id, raw, spendingSession);
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'payguard-service-unit-'));
  vi.stubEnv('DATABASE_URL', '');
  vi.stubEnv('LOCAL_DATABASE_PATH', directory);
  vi.stubEnv('ENABLE_AGENT_PAYMENTS', 'testnet');
  vi.stubEnv('SERVICE_PAYMENT_SETTLEMENT_ENABLED', 'true');
  vi.stubEnv('SERVICE_PAYMENT_PAYER', payer.toSuiAddress());
  vi.stubEnv('SERVICE_PAYMENT_RECIPIENT', '0x' + '8'.repeat(64));
  vi.stubEnv('TATUM_API_KEY', 'fixture-not-a-key');
  vi.stubEnv('APP_URL', 'http://localhost:3000');
  await migrate(await db(), { migrationsFolder: 'drizzle' });
  await seedDemo();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/verify') && verifyHook) return verifyHook();
      return new Response(
        JSON.stringify(
          url.endsWith('/supported')
            ? {
                kinds: ['sui:testnet', 'sui:mainnet'].map((network) => ({
                  x402Version: 2,
                  network,
                  scheme: 'exact',
                  extra: { gasOwner: '0x' + '3'.repeat(64), gasBudget: '2000000' },
                })),
              }
            : url.endsWith('/verify')
              ? { isValid: true }
              : (settles++, { success: true }),
        ),
        { status: 200 },
      );
    }),
  );
  mock.inspect.mockResolvedValue({
    source: 'SYNTHETIC MOCK, NOT NETWORK PROOF',
    receivedAtomic: '1000000',
  });
  mock.preflight.mockResolvedValue({
    source: 'SYNTHETIC MOCK, NOT NETWORK PROOF',
    genesis: serviceNetworkInfo('sui:mainnet').genesis,
    balances: {
      payer: { addressAtomic: '1000000', coinAtomic: '0', totalAtomic: '1000000' },
      recipient: null,
    },
  });
});
afterAll(async () => {
  await ((await db()) as unknown as { $client: PGlite }).$client.close();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await rm(directory, { recursive: true, force: true });
});
async function quote() {
  const invoice = (await listInvoices(OWNER_ID)).find((i) => i.number === 'NS-1048')!;
  return quoteService(OWNER_ID, invoice.id, randomUUID());
}
async function payload(row: Awaited<ReturnType<typeof quote>>) {
  const challenge = row.challenge as ServiceChallenge;
  const t = challenge.accepts[0];
  const tx = new Transaction();
  tx.setSender(payer.toSuiAddress());
  tx.setGasOwner(t.extra.gasOwner);
  tx.setGasBudget(t.extra.gasBudget);
  tx.setGasPrice(1000);
  tx.setGasPayment([]);
  tx.setExpiration({
    ValidDuring: {
      chain: serviceNetworkInfo(t.network).genesis,
      minEpoch: 1,
      maxEpoch: 2,
      minTimestamp: null,
      maxTimestamp: null,
      nonce: 1,
    },
  });
  const redeemed = tx.moveCall({
    target: '0x2::balance::redeem_funds',
    typeArguments: [t.asset],
    arguments: [tx.withdrawal({ type: t.asset, amount: BigInt(t.amount) })],
  });
  tx.moveCall({
    target: '0x2::balance::send_funds',
    typeArguments: [t.asset],
    arguments: [redeemed, tx.pure.address(t.payTo)],
  });
  tx.pure.string(t.extra.quoteId);
  const bytes = Buffer.from(await tx.build()).toString('base64');
  const signed = await payer.signTransaction(fromBase64(bytes));
  return {
    x402Version: 2,
    resource: challenge.resource,
    accepted: t,
    payload: { transaction: bytes, signature: signed.signature },
  };
}
it('durably deduplicates a quote and rejects another tenant', async () => {
  const row = await quote();
  expect((row.challenge as ServiceChallenge).resource.description).toContain('recipient change');
  expect((row.challenge as ServiceChallenge).resource.description).toContain(
    'purchase is not recommended',
  );
  expect((await quoteService(OWNER_ID, row.invoiceId, row.operationKey)).id).toBe(row.id);
  await expect(ownedService(randomUUID(), row.id)).rejects.toThrow('not found');
});
it('requires explicit approval and consumes a signed proof only once (mock settlement)', async () => {
  const row = await quote();
  const p = await payload(row);
  expect((await fulfillService(OWNER_ID, row.id, p)).state).toBe('quoted');
  await approveService(OWNER_ID, row.id, payer.toSuiAddress());
  await approveService(OWNER_ID, row.id, payer.toSuiAddress());
  const before = settles;
  expect((await fulfillService(OWNER_ID, row.id, p)).state).toBe('settled');
  expect((await fulfillService(OWNER_ID, row.id, p)).state).toBe('settled');
  expect(settles - before).toBe(1);
});
it('retains pending settlement through independent-verifier failure; resume never rebroadcasts', async () => {
  const row = await quote();
  await approveService(OWNER_ID, row.id, payer.toSuiAddress());
  mock.inspect.mockRejectedValueOnce(new Error('fixture timeout'));
  const before = settles;
  expect((await fulfillService(OWNER_ID, row.id, await payload(row))).state).toBe('pending');
  expect((await fulfillService(OWNER_ID, row.id)).state).toBe('settled');
  expect(settles - before).toBe(1);
});
it('Mainnet quotes and signatures are supported but the separate spend switch fails closed', async () => {
  vi.stubEnv('ENABLE_AGENT_PAYMENTS', 'mainnet');
  vi.stubEnv('SERVICE_PAYMENT_SETTLEMENT_ENABLED', 'false');
  const row = await quote();
  expect((row.challenge as ServiceChallenge).accepts[0].network).toBe('sui:mainnet');
  const before = settles;
  await approveService(OWNER_ID, row.id, payer.toSuiAddress());
  expect(settles).toBe(before);
  await expect(fulfillService(OWNER_ID, row.id, await payload(row))).rejects.toThrow('disabled');
  expect((await ownedService(OWNER_ID, row.id)).state).toBe('approved');
  expect((await ownedService(OWNER_ID, row.id)).digest).toBeNull();
  vi.stubEnv('SERVICE_PAYMENT_SETTLEMENT_ENABLED', 'true');
  await approveService(OWNER_ID, row.id, payer.toSuiAddress());
  expect((await fulfillService(OWNER_ID, row.id, await payload(row))).state).toBe('settled'); // MOCK only
  vi.stubEnv('ENABLE_AGENT_PAYMENTS', 'testnet');
});
it('refuses Mainnet quotes with a missing payer, reused merchant, insufficient address balance or unavailable provider', async () => {
  vi.stubEnv('ENABLE_AGENT_PAYMENTS', 'mainnet');
  try {
    vi.stubEnv('SERVICE_PAYMENT_PAYER', '');
    await expect(quote()).rejects.toThrow('quotes require');
    vi.stubEnv('SERVICE_PAYMENT_PAYER', process.env.SERVICE_PAYMENT_RECIPIENT!);
    await expect(quote()).rejects.toThrow('quotes require');
    vi.stubEnv('SERVICE_PAYMENT_PAYER', payer.toSuiAddress());
    mock.preflight.mockResolvedValueOnce({
      balances: { payer: { addressAtomic: '0', coinAtomic: '5000000' } },
    });
    await expect(quote()).rejects.toThrow('sufficient address-balance');
    mock.preflight.mockRejectedValueOnce(new Error('Synthetic provider outage'));
    await expect(quote()).rejects.toThrow('Synthetic provider outage');
  } finally {
    vi.stubEnv('SERVICE_PAYMENT_PAYER', payer.toSuiAddress());
    vi.stubEnv('ENABLE_AGENT_PAYMENTS', 'testnet');
  }
});
it('records a finalized failed transaction without a receipt or resettlement', async () => {
  const row = await quote();
  await approveService(OWNER_ID, row.id, payer.toSuiAddress());
  mock.inspect.mockRejectedValueOnce(
    new AppError(409, 'SETTLEMENT_FAILED', 'Tatum confirmed failure'),
  );
  const before = settles;
  expect((await fulfillService(OWNER_ID, row.id, await payload(row))).state).toBe('failed');
  expect((await fulfillService(OWNER_ID, row.id)).state).toBe('failed');
  expect(settles - before).toBe(1);
  await expect(cancelService(OWNER_ID, row.id)).rejects.toThrow('cannot be cancelled');
});
it('cancels an approved intent durably and never settles a cancelled proof', async () => {
  const row = await quote();
  await approveService(OWNER_ID, row.id, payer.toSuiAddress());
  const before = settles;
  expect((await cancelService(OWNER_ID, row.id)).state).toBe('cancelled');
  expect((await cancelService(OWNER_ID, row.id)).state).toBe('cancelled');
  await expect(approveService(OWNER_ID, row.id, payer.toSuiAddress())).rejects.toThrow(
    'Quote expired',
  );
  expect((await fulfillService(OWNER_ID, row.id, await payload(row))).state).toBe('cancelled');
  expect(settles).toBe(before);
});
it('blocks hosted wallet approval and settlement while Slush review is unresolved', async () => {
  const row = await quote();
  await approveService(OWNER_ID, row.id, payer.toSuiAddress());
  vi.stubEnv('VERCEL', '1');
  const before = settles;
  await expect(approveService(OWNER_ID, row.id, payer.toSuiAddress())).rejects.toThrow('paused');
  await expect(fulfillService(OWNER_ID, row.id, await payload(row))).rejects.toThrow('paused');
  expect(settles).toBe(before);
  vi.stubEnv('VERCEL', '');
});

it('requires fresh unsigned terms on the local origin while preserving the existing intent', async () => {
  const row = await quote();
  vi.stubEnv('APP_URL', 'http://localhost:4320');
  try {
    await expect(approveService(OWNER_ID, row.id, payer.toSuiAddress())).rejects.toThrow(
      'another application origin',
    );
    expect((await ownedService(OWNER_ID, row.id)).state).toBe('quoted');
  } finally {
    vi.stubEnv('APP_URL', 'http://localhost:3000');
  }
});

it('enforces a durable total session cap, idempotent approval and cancellation release', async () => {
  const rows = await Promise.all([quote(), quote(), quote(), quote()]);
  for (const row of rows.slice(0, 3)) await approveService(OWNER_ID, row.id, payer.toSuiAddress());
  expect(await serviceExposure(OWNER_ID, spendingSession)).toEqual({
    reservedAtomic: '3000000',
    capAtomic: '3000000',
  });
  expect((await serviceExposure(OWNER_ID, randomUUID())).reservedAtomic).toBe('0');
  await approveService(OWNER_ID, rows[0].id, payer.toSuiAddress());
  await expect(approveService(OWNER_ID, rows[3].id, payer.toSuiAddress())).rejects.toThrow('cap');
  await cancelService(OWNER_ID, rows[0].id);
  expect((await serviceExposure(OWNER_ID, spendingSession)).reservedAtomic).toBe('2000000');
  await approveService(OWNER_ID, rows[3].id, payer.toSuiAddress());
});
it('rejects a different authenticated session before submitting an approved signature', async () => {
  const row = await quote();
  await approveService(OWNER_ID, row.id, payer.toSuiAddress());
  const before = settles;
  await expect(fulfillCore(OWNER_ID, row.id, await payload(row), randomUUID())).rejects.toThrow(
    'current authenticated session',
  );
  expect(settles).toBe(before);
});
it('locks cancellation and the session reservation before facilitator verification receives signed bytes', async () => {
  const row = await quote();
  await approveService(OWNER_ID, row.id, payer.toSuiAddress());
  let release!: () => void, entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  verifyHook = async () => {
    entered();
    await gate;
    return Response.json({ isValid: true });
  };
  const submission = fulfillService(OWNER_ID, row.id, await payload(row));
  await started;
  expect((await ownedService(OWNER_ID, row.id)).state).toBe('settling');
  await expect(cancelService(OWNER_ID, row.id)).rejects.toThrow('cannot be cancelled');
  release();
  expect((await submission).state).toBe('settled');
});
it.each(['rejected', 'interrupted'])(
  'never settles or releases an exposed signature after verification is %s',
  async (kind) => {
    const row = await quote();
    await approveService(OWNER_ID, row.id, payer.toSuiAddress());
    verifyHook = async () => {
      if (kind === 'interrupted') throw new Error('Synthetic transport failure');
      return Response.json({ isValid: false });
    };
    const before = settles;
    expect((await fulfillService(OWNER_ID, row.id, await payload(row))).state).toBe('pending');
    await expect(cancelService(OWNER_ID, row.id)).rejects.toThrow('cannot be cancelled');
    mock.inspect.mockRejectedValueOnce(new Error('Synthetic digest not confirmed'));
    expect((await fulfillService(OWNER_ID, row.id)).state).toBe('pending');
    expect(settles).toBe(before);
  },
);
it('serializes concurrent reservations without exceeding the authenticated session cap', async () => {
  const rows = await Promise.all([quote(), quote(), quote(), quote()]);
  const results = await Promise.allSettled(
    rows.map((row) => approveService(OWNER_ID, row.id, payer.toSuiAddress())),
  );
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
  expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
});
it('uses only current, owned purchased analysis and preserves the supplier hold (mock receipt)', async () => {
  const row = await quote();
  await approveService(OWNER_ID, row.id, payer.toSuiAddress());
  const settled = await fulfillService(OWNER_ID, row.id, await payload(row));
  expect(settled.state).toBe('settled');
  const before = await assess(OWNER_ID, row.invoiceId, false);
  expect(before.findings.some((f) => f.id.startsWith('service-analysis-'))).toBe(true);
  expect(before.findings.some((f) => f.id === 'recipient-change')).toBe(true);
  const d = await db();
  await d
    .update(schema.servicePaymentIntents)
    .set({ instructionHash: '0'.repeat(64) })
    .where(eq(schema.servicePaymentIntents.id, row.id));
  // Other fixture receipts belong to this same invoice. Isolate this one by its exact id.
  const receipt = 'receipt' in settled ? settled.receipt : undefined;
  const after = await assess(OWNER_ID, row.invoiceId, false);
  expect(after.findings.some((f) => f.id === `service-analysis-${receipt?.id}`)).toBe(false);
  const other = randomUUID();
  await d.insert(schema.users).values({
    id: other,
    name: 'Synthetic foreign receipt account',
    settings: DEFAULT_PREFERENCES,
  });
  await d
    .update(schema.servicePaymentReceipts)
    .set({ tenantId: other })
    .where(eq(schema.servicePaymentReceipts.intentId, row.id));
  await d
    .update(schema.servicePaymentIntents)
    .set({ instructionHash: row.instructionHash })
    .where(eq(schema.servicePaymentIntents.id, row.id));
  await expect(fulfillService(OWNER_ID, row.id)).rejects.toThrow('owned settlement receipt');
  await expect(rememberService(OWNER_ID, row.id, true)).rejects.toThrow(
    'Tatum-confirmed service receipt',
  );
  expect(
    (await assess(OWNER_ID, row.invoiceId, false)).findings.some(
      (f) => f.id === `service-analysis-${receipt?.id}`,
    ),
  ).toBe(false);
});
it('does not reissue payable 402 terms for a cancelled or expired operation', async () => {
  const row = await quote();
  await cancelService(OWNER_ID, row.id);
  await expect(quoteService(OWNER_ID, row.invoiceId, row.operationKey)).rejects.toThrow(
    'expired, cancelled or submitted',
  );
  const expired = await quote();
  await (
    await db()
  )
    .update(schema.servicePaymentIntents)
    .set({ expiresAt: new Date(0) })
    .where(eq(schema.servicePaymentIntents.id, expired.id));
  await expect(quoteService(OWNER_ID, expired.invoiceId, expired.operationKey)).rejects.toThrow(
    'expired, cancelled or submitted',
  );
});
it('locks the digest and cap before zkLogin-capable signature verification can disclose bytes', async () => {
  const row = await quote();
  await approveService(OWNER_ID, row.id, payer.toSuiAddress());
  const before = settles;
  const signature = vi
    .spyOn(signatureVerifier, 'verifyServiceSignature')
    .mockImplementationOnce(async () => {
      const current = await ownedService(OWNER_ID, row.id);
      expect(current.state).toBe('settling');
      expect(current.digest).toBeTruthy();
      await expect(cancelService(OWNER_ID, row.id)).rejects.toThrow('cannot be cancelled');
      throw new Error('Synthetic zkLogin verification RPC interrupted');
    });
  try {
    const result = await fulfillService(OWNER_ID, row.id, await payload(row));
    expect(result.state).toBe('pending');
    expect(settles).toBe(before);
    await expect(cancelService(OWNER_ID, row.id)).rejects.toThrow('cannot be cancelled');
    expect((await ownedService(OWNER_ID, row.id)).state).toBe('settling');
  } finally {
    signature.mockRestore();
  }
});
it('requires separate explicit consent for a minimized owned post-purchase Walrus correction', async () => {
  const row = await quote();
  await approveService(OWNER_ID, row.id, payer.toSuiAddress());
  await fulfillService(OWNER_ID, row.id, await payload(row));
  const remember = vi
    .spyOn(memory, 'recordCorrection')
    .mockResolvedValue({ status: 'confirmed', blobId: 'SYNTHETIC_PROVIDER_FIXTURE' } as Awaited<
      ReturnType<typeof memory.recordCorrection>
    >);
  try {
    await expect(rememberService(OWNER_ID, row.id, false)).rejects.toThrow('Explicit consent');
    await expect(rememberService(randomUUID(), row.id, true)).rejects.toThrow('not found');
    expect(remember).not.toHaveBeenCalled();
    await rememberService(OWNER_ID, row.id, true);
    expect(remember).toHaveBeenCalledWith(
      OWNER_ID,
      expect.objectContaining({
        invoiceId: row.invoiceId,
        consent: true,
        kind: 'verify_address',
        scope: 'vendor',
        future: true,
        hard: false,
        value: '',
        operationKey: row.id,
      }),
    );
    const correction = remember.mock.calls[0][1];
    expect(correction.explanation).not.toContain(payer.toSuiAddress());
    expect(
      (await assess(OWNER_ID, row.invoiceId, false)).findings.some(
        (f) => f.id === 'recipient-change',
      ),
    ).toBe(true);
    await (
      await db()
    )
      .update(schema.servicePaymentIntents)
      .set({ instructionHash: '0'.repeat(64) })
      .where(eq(schema.servicePaymentIntents.id, row.id));
    await expect(rememberService(OWNER_ID, row.id, true)).rejects.toThrow('changed invoice');
  } finally {
    remember.mockRestore();
  }
});

it('persists immutable prepared bytes before signing and rejects a replacement transaction', async () => {
  const row = await quote();
  const p = await payload(row);
  await approveService(OWNER_ID, row.id, payer.toSuiAddress());
  const progress = await serviceProgress(OWNER_ID, row.id, spendingSession);
  expect(progress.prepared?.bytes).toBe(p.payload.transaction);
  expect(progress.prepared?.digest).toBe(await Transaction.from(p.payload.transaction).getDigest());
  expect(progress.executionDigest).toBeNull();
  expect(progress.submitted).toBe(false);
  const tx = Transaction.from(p.payload.transaction);
  tx.setGasPrice(1001);
  const changed = Buffer.from(await tx.build()).toString('base64');
  const signed = await payer.signTransaction(fromBase64(changed));
  const before = settles;
  await expect(
    fulfillService(OWNER_ID, row.id, {
      ...p,
      payload: { transaction: changed, signature: signed.signature },
    }),
  ).rejects.toThrow('saved prepared bytes');
  await expect(
    approveCore(OWNER_ID, row.id, payer.toSuiAddress(), spendingSession, changed),
  ).rejects.toThrow('immutable');
  expect(settles).toBe(before);
  expect((await ownedService(OWNER_ID, row.id)).state).toBe('approved');
});
it('records wallet rejection separately from a received or submitted payment', async () => {
  const row = await quote();
  await approveService(OWNER_ID, row.id, payer.toSuiAddress());
  const prep = (await serviceProgress(OWNER_ID, row.id, spendingSession)).prepared!;
  await recordServiceWalletEvent(
    OWNER_ID,
    row.id,
    { phase: 'requested', preparedDigest: prep.digest },
    spendingSession,
  );
  await recordServiceWalletEvent(
    OWNER_ID,
    row.id,
    {
      phase: 'error',
      preparedDigest: prep.digest,
      code: '4001',
      message: 'User rejected the transaction.',
    },
    spendingSession,
  );
  const p = await serviceProgress(OWNER_ID, row.id, spendingSession);
  expect(p.walletAttempted).toBe(true);
  expect(p.executionDigest).toBeNull();
  expect(p.submitted).toBe(false);
  expect(p.diagnostic?.message).toBe('User rejected the transaction.');
  await expect(
    recordServiceWalletEvent(
      OWNER_ID,
      row.id,
      { phase: 'error', preparedDigest: 'wrong' },
      spendingSession,
    ),
  ).rejects.toThrow('does not match');
});
it('preserves the exact Tentacle rejection and never retries a settlement on resume', async () => {
  const row = await quote();
  await approveService(OWNER_ID, row.id, payer.toSuiAddress());
  verifyHook = async () =>
    Response.json({ isValid: false, invalidReason: 'Sponsored gas owner mismatch' });
  const before = settles;
  const r = await fulfillService(OWNER_ID, row.id, await payload(row));
  expect(r.state).toBe('pending');
  expect(r.message).toContain('Sponsored gas owner mismatch');
  const p = await serviceProgress(OWNER_ID, row.id, spendingSession);
  expect(p.submitted).toBe(false);
  expect(p.diagnostic?.stage).toBe('tentacle.verify');
  mock.inspect.mockRejectedValueOnce(new Error('not found'));
  expect((await fulfillService(OWNER_ID, row.id)).state).toBe('pending');
  expect(settles).toBe(before);
});
