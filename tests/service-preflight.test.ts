import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  info: vi.fn(),
  coin: vi.fn(),
  epoch: vi.fn(),
  balance: vi.fn(),
  close: vi.fn(),
}));
vi.mock('@mysten/sui/grpc', () => ({
  SuiGrpcClient: class {
    ledgerService = { getServiceInfo: mock.info, getEpoch: mock.epoch };
    stateService = { getCoinInfo: mock.coin, getBalance: mock.balance };
  },
}));
vi.mock('@protobuf-ts/grpc-transport', () => ({
  GrpcTransport: class {
    close = mock.close;
  },
}));
import { serviceChainPreflight } from '@/lib/integrations/service-tatum';
import { MAINNET_GENESIS, SERVICE_ASSET } from '@/lib/service-protocol';
beforeEach(() => {
  vi.stubEnv('TATUM_API_KEY', 'synthetic-test-credential');
  vi.clearAllMocks();
  mock.info.mockResolvedValue({
    response: { chain: 'mainnet', chainId: MAINNET_GENESIS, checkpointHeight: 123n },
  });
  mock.coin.mockResolvedValue({ response: { coinType: SERVICE_ASSET, metadata: { decimals: 9 } } });
  mock.epoch.mockResolvedValue({
    response: {
      epoch: { protocolConfig: { featureFlags: { enable_address_balance_gas_payments: true } } },
    },
  });
  mock.balance.mockResolvedValue({
    response: {
      balance: {
        coinType: SERVICE_ASSET,
        balance: 5000000n,
        coinBalance: 4000000n,
        addressBalance: 1000000n,
      },
    },
  });
});
afterEach(() => vi.unstubAllEnvs());
it('separates exact coin and address funds after checking chain identity and enabled protocol', async () => {
  const r = await serviceChainPreflight('sui:mainnet', { payer: '0x' + '1'.repeat(64) });
  expect(r.addressBalanceGasEnabled).toBe(true);
  expect(r.balances.payer).toMatchObject({
    totalAtomic: '5000000',
    coinAtomic: '4000000',
    addressAtomic: '1000000',
  });
  expect(r.balances.recipient).toBeNull();
  expect(mock.close).toHaveBeenCalledOnce();
});
it('rejects wrong genesis, disabled feature and incomplete or inconsistent funds rather than reporting readiness', async () => {
  mock.info.mockResolvedValueOnce({ response: { chain: 'mainnet', chainId: 'wrong' } });
  await expect(serviceChainPreflight('sui:mainnet')).rejects.toThrow('identity');
  mock.epoch.mockResolvedValueOnce({
    response: { epoch: { protocolConfig: { featureFlags: {} } } },
  });
  await expect(serviceChainPreflight('sui:mainnet')).rejects.toThrow('not enabled');
  for (const balance of [
    { coinType: SERVICE_ASSET, balance: 1000000n },
    { coinType: SERVICE_ASSET, balance: 5000000n, coinBalance: 5000000n, addressBalance: 1000000n },
  ]) {
    mock.balance.mockResolvedValueOnce({ response: { balance } });
    await expect(
      serviceChainPreflight('sui:mainnet', { payer: '0x' + '1'.repeat(64) }),
    ).rejects.toThrow('Incomplete or inconsistent');
  }
  expect(mock.close).toHaveBeenCalledTimes(4);
});
