import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  unavailable: '',
  found: '',
  unknown: '',
  close: vi.fn(),
  calls: [] as string[],
}));
vi.mock('@protobuf-ts/grpc-transport', () => ({
  GrpcTransport: class {
    host: string;
    constructor(options: { host: string }) {
      this.host = options.host;
    }
    close = mock.close;
  },
}));
vi.mock('@mysten/sui/grpc', () => ({
  SuiGrpcClient: class {
    ledgerService;
    constructor({ transport }: { transport: { host: string } }) {
      const provider = transport.host.includes('tatum') ? 'tatum' : 'sui-fullnode';
      this.ledgerService = {
        getServiceInfo: async () => {
          mock.calls.push(provider + ':info');
          if (mock.unavailable === provider)
            throw Object.assign(Error('secret-test-key'), { code: 'UNAVAILABLE' });
          return {
            response: {
              chain: 'mainnet',
              chainId: MAINNET_GENESIS,
              checkpointHeight: 210n,
              lowestAvailableCheckpoint: 1n,
            },
          };
        },
        getEpoch: async ({ epoch }: { epoch?: bigint }) => ({
          response: {
            epoch:
              epoch === undefined
                ? {
                    epoch: 1302n,
                    protocolConfig: {
                      protocolVersion: 139n,
                      featureFlags: {
                        enable_multi_epoch_transaction_expiration: true,
                        enable_address_balance_gas_payments: true,
                      },
                    },
                  }
                : { epoch, firstCheckpoint: 100n, lastCheckpoint: 199n },
          },
        }),
        getTransaction: async () => {
          mock.calls.push(provider + ':transaction');
          if (mock.found === provider)
            return {
              response: {
                transaction: {
                  digest: 'SYNTHETIC_DIGEST',
                  checkpoint: 150n,
                  effects: { status: { success: true } },
                },
              },
            };
          if (mock.unknown === provider) return { response: {} };
          throw Object.assign(Error('missing'), { code: 'NOT_FOUND' });
        },
        getCheckpoint: async () => ({
          response: {
            checkpoint: {
              sequenceNumber: 199n,
              digest: 'SYNTHETIC_BOUNDARY',
              summary: { epoch: 1301n, endOfEpochData: {} },
            },
          },
        }),
      };
    }
  },
}));
import { MAINNET_GENESIS } from '@/lib/service-protocol';
import { assessServiceExpiry } from '@/lib/service-expiry';
import { readServiceExpiryEvidence } from '@/lib/integrations/service-expiry';
const window = { digest: 'SYNTHETIC_DIGEST', minEpoch: '1300', maxEpoch: '1301' };
beforeEach(() => {
  mock.unavailable = mock.found = mock.unknown = '';
  mock.calls = [];
  mock.close.mockClear();
  vi.stubEnv('TATUM_API_KEY', 'secret-test-key');
});
afterEach(() => vi.unstubAllEnvs());
it('reads both fixed providers once per digest and verifies epoch boundary and retention without signing or submitting', async () => {
  const e = await readServiceExpiryEvidence(window);
  expect(assessServiceExpiry(window, e).eligible).toBe(true);
  expect(mock.calls.filter((c) => c.endsWith(':transaction'))).toEqual([
    'tatum:transaction',
    'sui-fullnode:transaction',
  ]);
  expect(mock.close).toHaveBeenCalledTimes(2);
});
it.each(['tatum', 'sui-fullnode'])(
  'retains classified %s failure without leaking credentials or retrying',
  async (provider) => {
    mock.unavailable = provider;
    const e = await readServiceExpiryEvidence(window);
    expect(assessServiceExpiry(window, e).reason).toBe('PROVIDER_UNAVAILABLE');
    expect(mock.calls.filter((c) => c === provider + ':info')).toHaveLength(1);
    expect(JSON.stringify(e)).not.toContain('secret-test-key');
  },
);
it('preserves positive or incomplete transaction evidence instead of translating it into NOT_FOUND', async () => {
  mock.found = 'tatum';
  expect(assessServiceExpiry(window, await readServiceExpiryEvidence(window)).reason).toBe(
    'TRANSACTION_FOUND_RECONCILE',
  );
  mock.found = '';
  mock.unknown = 'sui-fullnode';
  expect(assessServiceExpiry(window, await readServiceExpiryEvidence(window)).reason).toBe(
    'TRANSACTION_UNCERTAIN',
  );
});
