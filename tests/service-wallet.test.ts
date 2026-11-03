import { it, expect } from 'vitest';
import {
  selectServiceAccount,
  selectPreparedServiceAccount,
  frozenServiceTransaction,
} from '@/lib/service-wallet';
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

const provider = (accounts = [account()]) => ({
  id: 'Nightly',
  name: 'Nightly',
  chains: ['sui:mainnet'],
  accounts,
  features: {
    'sui:signTransaction': {
      version: '2.0.0',
      signTransaction: () => {
        throw Error('No signing in account-selection tests');
      },
    },
  },
});
it('keeps the prepared Sui adapter when a Solana adapter has the same Nightly ID and name', () => {
  const sui = provider();
  const solana = { ...provider([]), chains: ['solana:mainnet'], features: {} };
  const registry = [solana, sui];
  expect(registry.find((w) => w.id === sui.id)).toBe(solana); // Original lookup causes the false warning.
  expect(selectPreparedServiceAccount(registry, sui, sui.accounts[0], customer)).toBe(
    sui.accounts[0],
  );
});
it('uses the provider current original account object when the same payer object was recreated', () => {
  const original = account();
  const current = { ...account('0x' + 'A'.repeat(64)), publicKey: new Uint8Array(32) };
  const sui = provider([current]);
  expect(selectPreparedServiceAccount([sui], sui, original, customer)).toBe(current);
});
it('does not substitute a re-registered or different provider even with the same account and ID', () => {
  const sui = provider();
  expect(() => selectPreparedServiceAccount([provider()], sui, sui.accounts[0], customer)).toThrow(
    'WALLET_PROVIDER_CHANGED',
  );
});
it('rejects actual account switching, disconnects and changed network or signing capability', () => {
  const approved = account();
  for (const [sui, code] of [
    [provider([account(owner)]), 'CUSTOMER_PAYER_REQUIRED'],
    [provider([]), 'WALLET_NO_ACCOUNTS'],
    [{ ...provider(), chains: ['sui:testnet'] }, 'WALLET_NETWORK_MISMATCH'],
    [{ ...provider(), features: {} }, 'WALLET_SIGNING_UNSUPPORTED'],
    [
      provider([{ ...approved, features: ['sui:signPersonalMessage'] }]),
      'WALLET_SIGNING_UNSUPPORTED',
    ],
  ] as const)
    expect(() => selectPreparedServiceAccount([sui], sui, approved, customer)).toThrow(code);
  const sui = provider();
  expect(() => selectPreparedServiceAccount([sui], sui, account(owner), customer)).toThrow(
    'CUSTOMER_PAYER_REQUIRED',
  );
  expect(() =>
    selectPreparedServiceAccount([sui], sui, approved, { ...customer, quotePayer: owner }),
  ).toThrow('QUOTE_PAYER_CHANGED');
});
