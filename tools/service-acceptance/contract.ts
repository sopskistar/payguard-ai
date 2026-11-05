import { Transaction } from '@mysten/sui/transactions';
import {
  parseServiceChallenge,
  validateServiceTransaction,
  MAINNET_GENESIS,
  type ServiceTerms,
} from '../../src/lib/service-protocol';

export const ACCEPTANCE_ORIGIN = 'https://payguard-ai-henna.vercel.app';
export const ACCEPTANCE_PAYER =
  '0xdce341eacb826d2a98abb80ed725bf38f0650a630789abb210e9a079c42365fa';
export const ACCEPTANCE_MERCHANT =
  '0x99eac0f7be358adf9f96ce0490392f356332af96376aadf11d829a529c1a189e';
export const ACCEPTANCE_INVOICE = '7e23bb74-37bd-42d4-8530-2ce80c934620';
export const OLD_ACCEPTANCE_QUOTE = '85e9fc3e-8871-4c15-ae3c-73de9f6421ca';
export function requireExactCustomer(address: string) {
  if (address !== ACCEPTANCE_PAYER) throw Error('TEST_KEY_ADDRESS_MISMATCH');
}
export function validateTerminalQuote(
  raw: {
    id: string;
    expiresAt: string;
    x402Version: unknown;
    resource: unknown;
    accepts: unknown;
  },
  sponsor: string,
  now = Date.now(),
) {
  const challenge = parseServiceChallenge(
    { x402Version: raw.x402Version, resource: raw.resource, accepts: raw.accepts },
    ACCEPTANCE_ORIGIN,
    'sui:mainnet',
  );
  const terms = challenge.accepts[0];
  if (
    raw.id === OLD_ACCEPTANCE_QUOTE ||
    raw.id !== terms.extra.quoteId ||
    terms.payTo !== ACCEPTANCE_MERCHANT ||
    terms.extra.authenticatedPayer !== ACCEPTANCE_PAYER ||
    terms.extra.gasOwner !== sponsor ||
    !Number.isFinite(Date.parse(raw.expiresAt)) ||
    Date.parse(raw.expiresAt) <= now + 15000 ||
    Date.parse(raw.expiresAt) > now + 301000
  )
    throw Error('FRESH_TERMS_CONFLICT');
  return { challenge, terms };
}
export async function validateTerminalPreparation(
  bytes: string,
  digest: string,
  terms: ServiceTerms,
  currentEpoch: string,
) {
  validateServiceTransaction(bytes, terms, ACCEPTANCE_PAYER);
  const tx = Transaction.from(bytes),
    data = tx.getData(),
    expiry = data.expiration;
  if (
    (await tx.getDigest()) !== digest ||
    expiry?.$kind !== 'ValidDuring' ||
    expiry.ValidDuring.chain !== MAINNET_GENESIS ||
    expiry.ValidDuring.minEpoch === null ||
    expiry.ValidDuring.maxEpoch === null ||
    BigInt(expiry.ValidDuring.minEpoch) > BigInt(currentEpoch) ||
    BigInt(expiry.ValidDuring.maxEpoch) < BigInt(currentEpoch)
  )
    throw Error('PREPARED_IDENTITY_OR_VALIDITY_CONFLICT');
  return {
    digest,
    network: terms.network,
    chain: MAINNET_GENESIS,
    payer: ACCEPTANCE_PAYER,
    merchant: terms.payTo,
    amountMist: terms.amount,
    amountSui: '0.001',
    sponsor: terms.extra.gasOwner,
    maximumSponsorGasMist: terms.extra.gasBudget,
    maximumPayerGasMist: '0',
    minEpoch: expiry.ValidDuring.minEpoch,
    maxEpoch: expiry.ValidDuring.maxEpoch,
    transactionData: data,
  };
}
export function requireTerminalApproval(answer: string, expected: string) {
  if (answer.trim() !== expected) throw Error('OWNER_DID_NOT_APPROVE');
}
