import { expect, it } from 'vitest';
import { validateServiceSettlement } from '@/lib/integrations/service-tatum';
import { serviceTermsSchema, type ServiceNetwork } from '@/lib/service-protocol';
import type { ChainTransaction } from '@/lib/integrations/tatum';
const payer = '0x' + '1'.repeat(64),
  recipient = '0x' + '2'.repeat(64),
  sponsor = '0x' + '3'.repeat(64);
const terms = (network: ServiceNetwork) =>
  serviceTermsSchema.parse({
    scheme: 'exact',
    network,
    asset: '0x2::sui::SUI',
    amount: '1000000',
    payTo: recipient,
    maxTimeoutSeconds: 300,
    extra: {
      gasOwner: sponsor,
      gasBudget: '2000000',
      quoteId: 'a0000000-0000-4000-8000-000000000001',
      instructionHash: 'a'.repeat(64),
    },
  });
const tx: ChainTransaction = {
  digest: 'synthetic-test-digest',
  checkpoint: '123',
  effects: { status: { status: 'success' } },
  transaction: { data: { sender: payer, gasData: { owner: sponsor } } },
  balanceChanges: [
    { owner: { AddressOwner: recipient }, coinType: '0x2::sui::SUI', amount: '1000000' },
  ],
};
it.each(['sui:mainnet', 'sui:testnet'] as const)(
  'requires exact independent finalized credit for %s (fixtures)',
  (network) => {
    expect(validateServiceSettlement(tx, tx.digest, terms(network), payer)).toBe(1000000n);
  },
);
it.each(['999999', '1000001', '-1000000'])('rejects incorrect merchant credit %s', (amount) => {
  expect(() =>
    validateServiceSettlement(
      { ...tx, balanceChanges: [{ ...tx.balanceChanges![0], amount }] },
      tx.digest,
      terms('sui:mainnet'),
      payer,
    ),
  ).toThrow();
});
it('rejects missing finality, wrong asset, sender, sponsor and digest', () => {
  for (const changed of [
    { ...tx, checkpoint: undefined },
    { ...tx, balanceChanges: [{ ...tx.balanceChanges![0], coinType: '0x3::other::OTHER' }] },
    { ...tx, transaction: { data: { sender: sponsor, gasData: { owner: sponsor } } } },
    { ...tx, transaction: { data: { sender: payer, gasData: { owner: payer } } } },
    { ...tx, digest: 'different-digest' },
  ])
    expect(() =>
      validateServiceSettlement(changed, tx.digest, terms('sui:mainnet'), payer),
    ).toThrow();
});
it('distinguishes a finalized execution failure from an unverified pending response', () => {
  expect(() =>
    validateServiceSettlement(
      { ...tx, effects: { status: { status: 'failure' } } },
      tx.digest,
      terms('sui:mainnet'),
      payer,
    ),
  ).toThrow('transaction failed');
  expect(() =>
    validateServiceSettlement(
      { ...tx, effects: undefined },
      tx.digest,
      terms('sui:mainnet'),
      payer,
    ),
  ).toThrow('differs');
});
