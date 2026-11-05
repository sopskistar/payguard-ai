import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  unavailable: '',
  found: '',
  unknown: '',
  close: vi.fn(),
  calls: [] as string[],
  quotaFailures: 0,
  transactionCalls: {} as Record<string, number>,
  infoCalls: {} as Record<string, number>,
  foundAt: 0,
  foundThenMissing: false,
  history: '',
  boundary: '',
  network: '',
  floorAfter: 1n,
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
          mock.infoCalls[provider] = (mock.infoCalls[provider] || 0) + 1;
          if (mock.unavailable === provider)
            throw Object.assign(Error('secret-test-key'), { code: 'UNAVAILABLE' });
          return {
            response: {
              chain: mock.network && provider === 'tatum' ? mock.network : 'mainnet',
              chainId: MAINNET_GENESIS,
              checkpointHeight: 210n,
              lowestAvailableCheckpoint: mock.infoCalls[provider] > 1 ? mock.floorAfter : 1n,
            },
          };
        },
        getEpoch: async ({ epoch }: { epoch?: bigint }) => {
          if (epoch !== undefined && provider === 'tatum') {
            mock.calls.push(provider + ':history');
            if (mock.quotaFailures-- > 0)
              throw Object.assign(Error('Received HTTP status code 429'), { code: 'UNAVAILABLE' });
            if (mock.history === 'pruned')
              throw Object.assign(Error('secret-test-key'), { code: 'NOT_FOUND' });
          }
          return {
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
                  : {
                      epoch: mock.history === 'wrong-epoch' ? 0n : epoch,
                      firstCheckpoint: 100n,
                      lastCheckpoint: 199n,
                    },
            },
          };
        },
        getTransaction: async () => {
          mock.calls.push(provider + ':transaction');
          const call = (mock.transactionCalls[provider] =
            (mock.transactionCalls[provider] || 0) + 1);
          if (
            (mock.found === provider && (!mock.foundThenMissing || call === 1)) ||
            (provider === 'tatum' && mock.foundAt === call)
          )
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
              sequenceNumber: mock.boundary === 'wrong-number' ? 198n : 199n,
              digest:
                mock.boundary === 'wrong-digest' && provider === 'tatum'
                  ? 'OTHER'
                  : 'SYNTHETIC_BOUNDARY',
              summary: { epoch: 1301n, endOfEpochData: mock.boundary === 'open' ? undefined : {} },
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
  vi.useFakeTimers();
  mock.unavailable = mock.found = mock.unknown = '';
  mock.calls = [];
  mock.quotaFailures = mock.foundAt = 0;
  mock.transactionCalls = {};
  mock.infoCalls = {};
  mock.foundThenMissing = false;
  mock.history = mock.boundary = mock.network = '';
  mock.floorAfter = 1n;
  mock.close.mockClear();
  vi.stubEnv('TATUM_API_KEY', 'secret-test-key');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function readEvidence() {
  const pending = readServiceExpiryEvidence(window);
  await vi.runAllTimersAsync();
  return pending;
}
it('reads both fixed providers before and after boundary verification without signing or submitting', async () => {
  const e = await readEvidence();
  expect(assessServiceExpiry(window, e).eligible).toBe(true);
  expect(mock.transactionCalls).toEqual({ tatum: 2, 'sui-fullnode': 2 });
  expect(e.every((v) => v.transactionLookups?.length === 2)).toBe(true);
  expect(mock.close).toHaveBeenCalledTimes(2);
});
it.each(['tatum', 'sui-fullnode'])(
  'retains classified %s failure without leaking credentials or retrying',
  async (provider) => {
    mock.unavailable = provider;
    const e = await readEvidence();
    expect(assessServiceExpiry(window, e).reason).toBe('PROVIDER_UNAVAILABLE');
    expect(mock.calls.filter((c) => c === provider + ':info')).toHaveLength(1);
    expect(JSON.stringify(e)).not.toContain('secret-test-key');
  },
);
it('preserves positive or incomplete transaction evidence instead of translating it into NOT_FOUND', async () => {
  mock.found = 'tatum';
  expect(assessServiceExpiry(window, await readEvidence()).reason).toBe(
    'TRANSACTION_FOUND_RECONCILE',
  );
  mock.found = '';
  mock.unknown = 'sui-fullnode';
  expect(assessServiceExpiry(window, await readEvidence()).reason).toBe('TRANSACTION_UNCERTAIN');
});
it('retains HTTP 429 as quota history and retries one read after cooldown', async () => {
  mock.quotaFailures = 1;
  const e = await readEvidence();
  expect(assessServiceExpiry(window, e).eligible).toBe(true);
  const reads = e[0].reads!.filter((r) => r.stage === 'first-valid-epoch');
  expect(reads.map((r) => [r.attempt, r.code, r.grpcCode, r.httpStatus])).toEqual([
    [1, 'RESOURCE_EXHAUSTED', 'UNAVAILABLE', 429],
    [2, 'OK', undefined, undefined],
  ]);
  expect(Date.parse(reads[1].checkedAt) - Date.parse(reads[0].checkedAt)).toBeGreaterThanOrEqual(
    1100,
  );
});
it('stops after persistent quota failures without skipping history or changing provider', async () => {
  mock.quotaFailures = 10;
  const e = await readEvidence();
  expect(e[0].error).toBe('RESOURCE_EXHAUSTED');
  expect(e[0].reads!.filter((r) => r.stage === 'first-valid-epoch')).toHaveLength(2);
  expect(e[0].boundaryClosed).toBeUndefined();
  expect(assessServiceExpiry(window, e).reason).toBe('PROVIDER_UNAVAILABLE');
});
it('holds if a transaction appears after the initial NOT_FOUND and preserves both observations', async () => {
  mock.foundAt = 2;
  const e = await readEvidence();
  expect(e[0].transactionLookups!.map((t) => t.outcome)).toEqual(['not-found', 'found']);
  expect(assessServiceExpiry(window, e).reason).toBe('TRANSACTION_FOUND_RECONCILE');
});
it('never erases a found transaction when a later lookup returns NOT_FOUND', async () => {
  mock.found = 'tatum';
  mock.foundThenMissing = true;
  const e = await readEvidence();
  expect(e[0].transactionLookups!.map((t) => t.outcome)).toEqual(['found', 'not-found']);
  expect(assessServiceExpiry(window, e).reason).toBe('TRANSACTION_FOUND_RECONCILE');
});
it.each(['pruned', 'wrong-epoch'])('fails closed for %s historical responses', async (history) => {
  mock.history = history;
  const e = await readEvidence();
  expect(assessServiceExpiry(window, e).eligible).toBe(false);
  expect(JSON.stringify(e)).not.toContain('secret-test-key');
});
it.each(['wrong-number', 'wrong-digest', 'open'])(
  'holds incorrect %s checkpoint boundaries',
  async (boundary) => {
    mock.boundary = boundary;
    expect(assessServiceExpiry(window, await readEvidence()).eligible).toBe(false);
  },
);
it('rejects another network and pruning that overtakes the validity window during the read', async () => {
  mock.network = 'testnet';
  expect(assessServiceExpiry(window, await readEvidence()).eligible).toBe(false);
  mock.network = '';
  mock.floorAfter = 101n;
  expect(assessServiceExpiry(window, await readEvidence()).reason).toBe(
    'HISTORY_COVERAGE_UNPROVEN',
  );
});
