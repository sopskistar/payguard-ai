import { normalizeSuiAddress } from '@mysten/sui/utils';
import type { ServiceNetwork } from './service-protocol';
import type { RequestDiagnostic } from './request-diagnostics';

// Match dApp Kit's Transaction|string signing contract: already approved BCS bytes
// pass through toJSON unchanged. No rebuild or network resolution inside the wallet call.
export function frozenServiceTransaction(bytes: string) {
  return { toJSON: async () => bytes };
}

export type ServiceWalletAccount = {
  address: string;
  chains: readonly string[];
  features: readonly string[];
};
export class ServiceAccountError extends Error {
  diagnostic: RequestDiagnostic;
  constructor(code: string, message: string, action: string) {
    super(`${code}: ${message}`);
    this.diagnostic = {
      category: 'wallet',
      stage: 'wallet-account-selection',
      code,
      message,
      action,
    };
  }
}
const canonical = (value: string) =>
  /^0x[\da-f]{1,64}$/i.test(value) ? normalizeSuiAddress(value) : null;

export function selectServiceAccount<T extends ServiceWalletAccount>(
  accounts: readonly T[],
  options: {
    network: ServiceNetwork;
    expectedPayer: string | null;
    audience: 'owner' | 'customer';
    authenticatedWallet?: string;
    quotePayer?: string;
  },
): T {
  const expected = options.expectedPayer && canonical(options.expectedPayer);
  if (!expected)
    throw new ServiceAccountError(
      'CHECKOUT_PAYER_MISSING',
      'The server did not identify a payer for this workspace.',
      'Refresh workspace capabilities before requesting terms.',
    );
  if (options.audience === 'customer' && canonical(options.authenticatedWallet || '') !== expected)
    throw new ServiceAccountError(
      'CHECKOUT_SESSION_CHANGED',
      'Workspace identity and checkout identity differ.',
      'Reload and authenticate the wallet workspace again. Do not replace an existing submitted payment.',
    );
  if (options.quotePayer && canonical(options.quotePayer) !== expected)
    throw new ServiceAccountError(
      'QUOTE_PAYER_CHANGED',
      'This quote belongs to another authenticated wallet.',
      'Resume its original workspace; never sign another account’s quote.',
    );
  if (!accounts.length)
    throw new ServiceAccountError(
      'WALLET_NO_ACCOUNTS',
      'The wallet returned no connected accounts.',
      'Connect the intended Sui account. Stop at any provider warning or refusal.',
    );
  const account = accounts.find((a) => canonical(a.address) === expected);
  if (!account)
    throw new ServiceAccountError(
      options.audience === 'owner' ? 'OWNER_PAYER_REQUIRED' : 'CUSTOMER_PAYER_REQUIRED',
      `${options.audience === 'owner' ? 'This is administrator checkout, which uses the configured owner payer' : 'This purchase belongs to your signed-in wallet'} ${expected}. The selected wallet returned a different account.`,
      options.audience === 'owner'
        ? 'To pay with your personal Nightly account, use Switch to wallet workspace and complete the free wallet sign-in. Owner invoices remain private.'
        : 'Select the same account used for your free sign-in, or sign out and authenticate the intended wallet.',
    );
  if (!account.chains.includes(options.network))
    throw new ServiceAccountError(
      'WALLET_NETWORK_MISMATCH',
      `The matching account does not advertise ${options.network}.`,
      'Select Sui Mainnet in the wallet and reconnect that same account.',
    );
  if (!account.features.includes('sui:signTransaction'))
    throw new ServiceAccountError(
      'WALLET_SIGNING_UNSUPPORTED',
      'The matching account does not advertise transaction signing.',
      'Free message authentication does not prove financial-signing support. Use a provider/account supporting sui:signTransaction; no legacy execution fallback is used.',
    );
  return account;
}
