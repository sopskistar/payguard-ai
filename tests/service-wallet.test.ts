import { it, expect } from 'vitest';
import { selectServiceAccount } from '@/lib/service-wallet';
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
