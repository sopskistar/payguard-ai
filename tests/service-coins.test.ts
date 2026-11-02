import { it, expect } from 'vitest';
import { Transaction } from '@mysten/sui/transactions';
import type { SuiClientTypes } from '@mysten/sui/client';
import {
  buildServiceTransaction,
  validateServiceTransaction,
  serviceTermsSchema,
  MAINNET_GENESIS,
} from '@/lib/service-protocol';
import { checkServiceCoinObjects, selectServiceCoins } from '@/lib/service-funding';
const payer = '0x' + '1'.repeat(64);
const terms = serviceTermsSchema.parse({
  scheme: 'exact',
  network: 'sui:mainnet',
  asset: '0x2::sui::SUI',
  amount: '1000000',
  payTo: '0x' + '2'.repeat(64),
  maxTimeoutSeconds: 300,
  extra: {
    gasOwner: '0x' + '3'.repeat(64),
    gasBudget: '2000000',
    quoteId: 'a0000000-0000-4000-8000-000000000001',
    instructionHash: 'a'.repeat(64),
    authenticatedPayer: payer,
  },
});
const state = { genesis: MAINNET_GENESIS, epoch: 1296, gasPrice: '100', nonce: 123 };
function coin(id: string, balance: string): SuiClientTypes.Coin {
  return {
    objectId: '0x' + id.repeat(64),
    version: '1',
    digest: '11111111111111111111111111111111',
    owner: { $kind: 'AddressOwner', AddressOwner: payer },
    type: '0x2::coin::Coin<0x2::sui::SUI>',
    balance,
  };
}
it.each([
  [[coin('4', '9000000')], '0', '0'],
  [[coin('4', '600000'), coin('5', '700000')], '0', '0'],
  [[coin('4', '600000')], '400000', '400000'],
])(
  'accepts only the exact owned-coin template and minimum mixed withdrawal %#',
  async (coins, address, expected) => {
    const funding = selectServiceCoins(coins, payer, terms.amount, address);
    expect(funding.addressWithdrawal).toBe(expected);
    checkServiceCoinObjects(funding, coins, payer, terms.amount, address);
    const tx = buildServiceTransaction(terms, payer, { ...state, funding });
    const bytes = Buffer.from(await tx.build()).toString('base64');
    expect(() => validateServiceTransaction(bytes, terms, payer)).not.toThrow();
    expect(tx.getData().gasData.payment).toEqual([]);
    // No transfer of coin change or self-deposit: only the merchant receives funds.
    expect(tx.getData().commands.filter((c) => c.$kind === 'TransferObjects')).toHaveLength(0);
    tx.transferObjects([tx.object(funding.coins[0].objectId)], tx.pure.address(terms.payTo));
    const altered = Buffer.from(await tx.build()).toString('base64');
    expect(() => validateServiceTransaction(altered, terms, payer)).toThrow();
  },
);
it('rejects stale references, foreign ownership, other assets, excessive withdrawals and fragmented funding', () => {
  const c = coin('4', '600000');
  const plan = selectServiceCoins([c], payer, terms.amount, '400000');
  for (const diff of [
    { version: '2' },
    { digest: 'other' },
    { owner: { $kind: 'AddressOwner' as const, AddressOwner: terms.payTo } },
    { type: '0x2::coin::Coin<0x2::other::OTHER>' },
  ])
    expect(() =>
      checkServiceCoinObjects(plan, [{ ...c, ...diff }], payer, terms.amount, '400000'),
    ).toThrow();
  expect(() =>
    checkServiceCoinObjects(
      { ...plan, addressWithdrawal: '500000' },
      [c],
      payer,
      terms.amount,
      '500000',
    ),
  ).toThrow();
  expect(() => selectServiceCoins([c], payer, terms.amount, '399999')).toThrow('Insufficient');
  expect(() =>
    buildServiceTransaction(terms, payer, { ...state, funding: { ...plan, coins: [c, c] } }),
  ).toThrow();
});
it('rejects extra pure inputs, wrong sponsor, wrong recipient and sponsor gas access', async () => {
  const funding = selectServiceCoins([coin('4', '9000000')], payer, terms.amount, '0');
  for (const change of [
    (tx: Transaction) => tx.pure.address(payer),
    (tx: Transaction) => tx.setGasOwner(payer),
    (tx: Transaction) => tx.splitCoins(tx.gas, [1]),
  ]) {
    const tx = buildServiceTransaction(terms, payer, { ...state, funding });
    change(tx);
    const bytes = Buffer.from(await tx.build()).toString('base64');
    expect(() => validateServiceTransaction(bytes, terms, payer)).toThrow();
  }
  const tx = buildServiceTransaction(terms, payer, { ...state, funding });
  const bytes = Buffer.from(await tx.build()).toString('base64');
  expect(() => validateServiceTransaction(bytes, { ...terms, payTo: payer }, payer)).toThrow();
});
