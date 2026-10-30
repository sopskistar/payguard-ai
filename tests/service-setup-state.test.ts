import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ chain: vi.fn() }));
vi.mock('@/lib/integrations/service-tatum', () => ({
  serviceChainPreflight: mock.chain,
  inspectServiceSettlement: vi.fn(),
}));
import { serviceSetup } from '@/lib/service-payments';
import { failedPaymentCheck } from '@/lib/service-setup';
import { MAINNET_GENESIS } from '@/lib/service-protocol';
const payer = '0x' + '1'.repeat(64),
  recipient = '0x' + '2'.repeat(64);
beforeEach(() => {
  vi.stubEnv('APP_URL', 'https://payguard-ai-henna.vercel.app');
  vi.stubEnv('SERVICE_PAYMENT_PAYER', payer);
  vi.stubEnv('SERVICE_PAYMENT_RECIPIENT', recipient);
  vi.stubEnv('TATUM_API_KEY', 'fixture-credential-never-return');
  vi.stubEnv('ENABLE_AGENT_PAYMENTS', 'false');
  vi.stubEnv('SERVICE_PAYMENT_SETTLEMENT_ENABLED', 'false');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        kinds: [
          {
            x402Version: 2,
            scheme: 'exact',
            network: 'sui:mainnet',
            extra: { gasOwner: '0x' + '3'.repeat(64), gasBudget: '2000000' },
          },
        ],
      }),
    ),
  );
  mock.chain.mockReset().mockResolvedValue({
    genesis: MAINNET_GENESIS,
    checkpoint: '123',
    diagnostics: [],
    balances: {
      payer: {
        owner: payer,
        totalAtomic: '27993344',
        coinAtomic: '27993344',
        addressAtomic: '0',
        checkedAt: '2026-10-30T13:00:00.000Z',
      },
      recipient: {
        owner: recipient,
        totalAtomic: '0',
        coinAtomic: '0',
        addressAtomic: '0',
        checkedAt: '2026-10-30T13:00:00.000Z',
      },
    },
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it('checks both deployed addresses with both flags false; successful reads do not imply usable funds or signing approval', async () => {
  const result = await serviceSetup(true);
  expect(result.check.state).toBe('passed');
  expect(result.quoteEnabled).toBe(false);
  expect(result.settlementEnabled).toBe(false);
  expect(result.check.preflight?.sufficientlyFunded).toBe(false);
  expect(result.check.preflight?.readyForQuotePreparation).toBe(false);
  expect(mock.chain).toHaveBeenCalledWith(
    'sui:mainnet',
    { payer, recipient },
    { allowPartial: true },
  );
  expect(JSON.stringify(result)).not.toContain('fixture-credential-never-return');
});
it('keeps successful Tatum balances when Tentacle fails and returns safe per-stage classification', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('', { status: 429 })),
  );
  const result = await serviceSetup(true);
  expect(result.check.state).toBe('partial');
  expect(result.check.preflight?.chain.balances.payer?.totalAtomic).toBe('27993344');
  expect(result.check.diagnostics.find((d) => d.stage === 'tentacle.supported')).toMatchObject({
    status: 'failed',
    classification: 'rate_limit',
    code: 'RESOURCE_EXHAUSTED',
  });
  expect(result.check.preflight?.readyForQuotePreparation).toBe(false);
});
it('never exposes arbitrary provider errors or sensitive headers in diagnostics', () => {
  const error = Object.assign(new Error('Bearer private-api-key-value'), {
    code: 'BAD-private-api-key-value',
    headers: { 'x-api-key': 'private-api-key-value' },
  });
  const result = failedPaymentCheck('balance.payer', 'Wallet A', error);
  expect(result.code).toBe('UNKNOWN');
  expect(JSON.stringify(result)).not.toContain('private-api-key-value');
  expect(failedPaymentCheck('tatum.connection', 'Tatum', { code: 16 })).toMatchObject({
    classification: 'authentication',
    code: 'UNAUTHENTICATED',
  });
  expect(
    failedPaymentCheck('balance.payer', 'Wallet A', {
      code: 'UNAVAILABLE',
      message: 'Received HTTP status code 429',
    }),
  ).toMatchObject({ classification: 'rate_limit', code: 'RESOURCE_EXHAUSTED' });
});
