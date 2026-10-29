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
const mock = vi.hoisted(() => ({ inspect: vi.fn() }));
vi.mock('@/lib/integrations/service-tatum', () => ({ inspectServiceSettlement: mock.inspect }));
import { db } from '@/db';
import { seedDemo, listInvoices } from '@/lib/store';
import { OWNER_ID } from '@/lib/demo';
import {
  quoteService,
  approveService as approveCore,
  fulfillService as fulfillCore,
  ownedService,
  cancelService,
} from '@/lib/service-payments';
import { serviceNetworkInfo, type ServiceChallenge } from '@/lib/service-protocol';
import { AppError } from '@/lib/errors';
import { assess } from '@/lib/integrations/memory';
import { DEFAULT_PREFERENCES } from '@/lib/types';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';
let directory: string;
let settles = 0;
const payer = Ed25519Keypair.generate();
let spendingSession = randomUUID();
beforeEach(() => {
  spendingSession = randomUUID();
});
const approveService = (tenant: string, id: string, address: string) =>
  approveCore(tenant, id, address, spendingSession);
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
    vi.fn(
      async (url: string) =>
        new Response(
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
        ),
    ),
  );
  mock.inspect.mockResolvedValue({
    source: 'SYNTHETIC MOCK, NOT NETWORK PROOF',
    receivedAtomic: '1000000',
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
  await expect(approveService(OWNER_ID, row.id, payer.toSuiAddress())).rejects.toThrow('disabled');
  vi.stubEnv('SERVICE_PAYMENT_SETTLEMENT_ENABLED', 'true');
  await approveService(OWNER_ID, row.id, payer.toSuiAddress());
  expect((await fulfillService(OWNER_ID, row.id, await payload(row))).state).toBe('settled'); // MOCK only
  vi.stubEnv('ENABLE_AGENT_PAYMENTS', 'testnet');
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

it('enforces a durable total session cap, idempotent approval and cancellation release', async () => {
  const rows = await Promise.all([quote(), quote(), quote(), quote()]);
  for (const row of rows.slice(0, 3)) await approveService(OWNER_ID, row.id, payer.toSuiAddress());
  await approveService(OWNER_ID, rows[0].id, payer.toSuiAddress());
  await expect(approveService(OWNER_ID, rows[3].id, payer.toSuiAddress())).rejects.toThrow('cap');
  await cancelService(OWNER_ID, rows[0].id);
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
  expect(
    (await assess(OWNER_ID, row.invoiceId, false)).findings.some(
      (f) => f.id === `service-analysis-${receipt?.id}`,
    ),
  ).toBe(false);
});
