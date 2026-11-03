import { it, expect } from 'vitest';
import { selectServiceAccount, frozenServiceTransaction } from '@/lib/service-wallet';
import {
  buildServiceTransaction,
  serviceTermsSchema,
  serviceNetworkInfo,
} from '@/lib/service-protocol';
import { Transaction } from '@mysten/sui/transactions';
import { toBase64, fromBase64 } from '@mysten/sui/utils';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { verifyTransactionSignature } from '@mysten/sui/verify';
const owner = '0x' + '1'.repeat(64),
  member = '0x' + 'a'.repeat(64);
const account = (address = member) => ({
  address,
  chains: ['sui:mainnet'],
  features: ['sui:signTransaction', 'sui:signPersonalMessage'],
});
const customer = {
  network: 'sui:mainnet' as const,
  audience: 'customer' as const,
  expectedPayer: member,
  authenticatedWallet: member,
  quotePayer: member,
};
it('passes frozen BCS through the current Wallet Standard input and verifies its exact signer offline', async () => {
  const signer = Ed25519Keypair.generate();
  const terms = serviceTermsSchema.parse({
    scheme: 'exact',
    network: 'sui:mainnet',
    asset: '0x2::sui::SUI',
    amount: '1000000',
    payTo: owner,
    maxTimeoutSeconds: 300,
    extra: {
      gasOwner: member,
      gasBudget: '2000000',
      quoteId: 'a0000000-0000-4000-8000-000000000001',
      instructionHash: 'a'.repeat(64),
    },
  });
  const tx = buildServiceTransaction(terms, signer.toSuiAddress(), {
    genesis: serviceNetworkInfo('sui:mainnet').genesis,
    epoch: 1300,
    gasPrice: '100',
    nonce: 42,
  });
  const bytes = toBase64(await tx.build());
  const input = await frozenServiceTransaction(bytes).toJSON();
  expect(input).toBe(bytes);
  const signed = await signer.signTransaction(await Transaction.from(input).build());
  expect(signed.bytes).toBe(bytes);
  await expect(
    verifyTransactionSignature(fromBase64(bytes), signed.signature, {
      address: signer.toSuiAddress(),
    }),
  ).resolves.toBeDefined();
  await expect(
    verifyTransactionSignature(fromBase64(bytes), signed.signature, { address: owner }),
  ).rejects.toThrow();
});
it('explains the observed owner-session versus Nightly-member mismatch without relaxing payer binding', () => {
  try {
    selectServiceAccount([account()], {
      ...customer,
      audience: 'owner',
      expectedPayer: owner,
      quotePayer: undefined,
    });
    throw Error('must fail');
  } catch (e) {
    expect(e).toMatchObject({ diagnostic: { code: 'OWNER_PAYER_REQUIRED' } });
    expect((e as Error).message).toContain('administrator checkout');
  }
});
it('chooses the authenticated member among multiple accounts and never falls back to owner funds', () => {
  const nightly = account();
  expect(selectServiceAccount([account(owner), nightly], customer)).toBe(nightly);
  expect(() => selectServiceAccount([account(owner)], customer)).toThrow('CUSTOMER_PAYER_REQUIRED');
});
it('compares equivalent Sui address representations while retaining the original provider account', () => {
  const nightly = account('0x' + 'A'.repeat(64));
  expect(selectServiceAccount([nightly], customer)).toBe(nightly);
});
it('separates missing accounts, network and financial-feature rejection', () => {
  expect(() => selectServiceAccount([], customer)).toThrow('WALLET_NO_ACCOUNTS');
  expect(() => selectServiceAccount([{ ...account(), chains: ['sui:testnet'] }], customer)).toThrow(
    'WALLET_NETWORK_MISMATCH',
  );
  expect(() =>
    selectServiceAccount([{ ...account(), features: ['sui:signPersonalMessage'] }], customer),
  ).toThrow('WALLET_SIGNING_UNSUPPORTED');
});
it('rejects stale session, quote and missing configured payer before any signing', () => {
  expect(() =>
    selectServiceAccount([account()], { ...customer, authenticatedWallet: owner }),
  ).toThrow('CHECKOUT_SESSION_CHANGED');
  expect(() => selectServiceAccount([account()], { ...customer, quotePayer: owner })).toThrow(
    'QUOTE_PAYER_CHANGED',
  );
  expect(() => selectServiceAccount([account()], { ...customer, expectedPayer: null })).toThrow(
    'CHECKOUT_PAYER_MISSING',
  );
});
