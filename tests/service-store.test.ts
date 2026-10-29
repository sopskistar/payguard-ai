import { beforeAll, afterAll, it, expect, vi } from 'vitest';
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
  approveService,
  fulfillService,
  ownedService,
  cancelService,
} from '@/lib/service-payments';
import { TESTNET_GENESIS, type ServiceChallenge } from '@/lib/service-protocol';
let directory: string;
let settles = 0;
const payer = Ed25519Keypair.generate();
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'payguard-service-unit-'));
  vi.stubEnv('DATABASE_URL', '');
  vi.stubEnv('LOCAL_DATABASE_PATH', directory);
  vi.stubEnv('ENABLE_AGENT_PAYMENTS', 'testnet');
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
                  kinds: [
                    {
                      x402Version: 2,
                      network: 'sui:testnet',
                      scheme: 'exact',
                      extra: { gasOwner: '0x' + '3'.repeat(64), gasBudget: '2000000' },
                    },
                  ],
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
      chain: TESTNET_GENESIS,
      minEpoch: 1,
      maxEpoch: 2,
      minTimestamp: null,
      maxTimestamp: null,
      nonce: 1,
    },
  });
  tx.moveCall({
    target: '0x2::balance::send_funds',
    typeArguments: [t.asset],
    arguments: [
      tx.withdrawal({ type: t.asset, amount: BigInt(t.amount) }),
      tx.pure.address(t.payTo),
    ],
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
it('Mainnet configuration cannot enable settlement', async () => {
  vi.stubEnv('ENABLE_AGENT_PAYMENTS', 'mainnet');
  await expect(quote()).rejects.toThrow('disabled');
  vi.stubEnv('ENABLE_AGENT_PAYMENTS', 'testnet');
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
