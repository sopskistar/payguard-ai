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
import { serviceChainPreflight, parseServiceBalance } from '@/lib/integrations/service-tatum';
import { MAINNET_GENESIS, SERVICE_ASSET } from '@/lib/service-protocol';
beforeEach(() => {
  vi.stubEnv('TATUM_API_KEY', 'synthetic-test-credential');
  for (const fn of Object.values(mock)) fn.mockReset();
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
  await expect(serviceChainPreflight('sui:mainnet')).rejects.toMatchObject({
    code: 'CHAIN_IDENTITY',
  });
  mock.epoch.mockResolvedValueOnce({
    response: { epoch: { protocolConfig: { featureFlags: {} } } },
  });
  await expect(serviceChainPreflight('sui:mainnet')).rejects.toMatchObject({
    code: 'PROTOCOL_FEATURE',
  });
  for (const [balance, code] of [
    [{ coinType: SERVICE_ASSET, balance: 1000000n }, 'BALANCE_COMPONENTS'],
    [
      {
        coinType: SERVICE_ASSET,
        balance: 5000000n,
        coinBalance: 5000000n,
        addressBalance: 1000000n,
      },
      'BALANCE_INCONSISTENT',
    ],
  ] as const) {
    mock.balance.mockResolvedValueOnce({ response: { balance } });
    await expect(
      serviceChainPreflight('sui:mainnet', { payer: '0x' + '1'.repeat(64) }),
    ).rejects.toMatchObject({ code });
  }
  expect(mock.close).toHaveBeenCalledTimes(4);
});
it('accepts actual Tatum omitted-zero shapes only when explicit total proves each component', () => {
  expect(
    parseServiceBalance({ coinType: SERVICE_ASSET, balance: 27993344n, coinBalance: 27993344n }),
  ).toMatchObject({ totalAtomic: '27993344', coinAtomic: '27993344', addressAtomic: '0' });
  expect(parseServiceBalance({ coinType: SERVICE_ASSET, balance: 0n })).toMatchObject({
    totalAtomic: '0',
    coinAtomic: '0',
    addressAtomic: '0',
  });
  expect(
    parseServiceBalance({
      coinType: SERVICE_ASSET,
      balance: 9007199254740993n,
      addressBalance: 1000000n,
    }).coinAtomic,
  ).toBe('9007199253740993');
  for (const value of [undefined, {}, { coinType: SERVICE_ASSET, coinBalance: 0n }])
    expect(() => parseServiceBalance(value)).toThrow('BALANCE_MISSING');
  expect(() => parseServiceBalance({ coinType: SERVICE_ASSET, balance: 1n })).toThrow(
    'BALANCE_COMPONENTS',
  );
  expect(() =>
    parseServiceBalance({ coinType: SERVICE_ASSET, balance: 1n, coinBalance: 2n }),
  ).toThrow('BALANCE_INCONSISTENT');
});
it('preserves Wallet A when Wallet B times out and reports the failed stage without secrets', async () => {
  mock.balance.mockImplementation(async ({ owner }: { owner: string }) => {
    if (owner.endsWith('2'))
      throw Object.assign(new Error('synthetic-test-credential must never be returned'), {
        code: 'DEADLINE_EXCEEDED',
      });
    return {
      response: {
        balance: { coinType: SERVICE_ASSET, balance: 27993344n, coinBalance: 27993344n },
      },
    };
  });
  const result = await serviceChainPreflight(
    'sui:mainnet',
    { payer: '0x' + '1'.repeat(64), recipient: '0x' + '2'.repeat(64) },
    { allowPartial: true },
  );
  expect(result.balances.payer?.coinAtomic).toBe('27993344');
  expect(result.balances.recipient).toBeNull();
  expect(result.diagnostics.find((d) => d.stage === 'balance.recipient')).toMatchObject({
    status: 'failed',
    code: 'DEADLINE_EXCEEDED',
    classification: 'timeout',
  });
  expect(JSON.stringify(result)).not.toContain('synthetic-test-credential');
  expect(result.balances.payer?.checkedAt).toMatch(/^\d{4}-/);
});
it('does not query balances on an unverified chain, but reads them when only the payment protocol feature fails', async () => {
  mock.info.mockRejectedValueOnce(
    Object.assign(new Error('private detail'), { code: 'UNAUTHENTICATED' }),
  );
  const denied = await serviceChainPreflight(
    'sui:mainnet',
    { payer: '0x' + '1'.repeat(64) },
    { allowPartial: true },
  );
  expect(mock.balance).not.toHaveBeenCalled();
  expect(denied.diagnostics.find((d) => d.stage === 'tatum.connection')).toMatchObject({
    classification: 'authentication',
  });
  expect(denied.diagnostics.find((d) => d.stage === 'balance.payer')?.status).toBe('skipped');
  mock.epoch.mockResolvedValueOnce({
    response: { epoch: { protocolConfig: { featureFlags: {} } } },
  });
  const result = await serviceChainPreflight(
    'sui:mainnet',
    { payer: '0x' + '1'.repeat(64) },
    { allowPartial: true },
  );
  expect(result.balances.payer?.totalAtomic).toBe('5000000');
  expect(result.addressBalanceGasEnabled).toBe(false);
});
it('paces the complete preflight within a provider enforcing three requests per second', async () => {
  const starts: number[] = [];
  const limited =
    <T>(response: T) =>
    async () => {
      const now = Date.now();
      starts.push(now);
      if (starts.filter((t) => now - t < 1000).length > 3)
        throw Object.assign(new Error('Received HTTP status code 429'), { code: 'UNAVAILABLE' });
      return { response };
    };
  mock.info.mockImplementation(
    limited({ chain: 'mainnet', chainId: MAINNET_GENESIS, checkpointHeight: 123n }),
  );
  mock.coin.mockImplementation(limited({ coinType: SERVICE_ASSET, metadata: { decimals: 9 } }));
  mock.epoch.mockImplementation(
    limited({
      epoch: { protocolConfig: { featureFlags: { enable_address_balance_gas_payments: true } } },
    }),
  );
  mock.balance.mockImplementation(limited({ balance: { coinType: SERVICE_ASSET, balance: 0n } }));
  const result = await serviceChainPreflight(
    'sui:mainnet',
    { payer: '0x' + '1'.repeat(64), recipient: '0x' + '2'.repeat(64) },
    { allowPartial: true },
  );
  expect(result.diagnostics.every((d) => d.status === 'passed')).toBe(true);
  expect(result.balances.recipient?.totalAtomic).toBe('0');
  expect(starts).toHaveLength(5);
});
