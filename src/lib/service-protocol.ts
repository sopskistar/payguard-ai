import { z } from 'zod';
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { fromBase64, normalizeSuiAddress, normalizeStructTag } from '@mysten/sui/utils';
export const TESTNET_GENESIS = '69WiPg3DAQiwdxfncX6wYQ2siKwAe6L9BZthQea3JNMD';
export const SERVICE_NETWORK = 'sui:testnet' as const;
export const SERVICE_AMOUNT = '1000000';
export const SERVICE_ASSET = '0x2::sui::SUI';
export const FACILITATOR = 'https://facilitator.tentaclepay.com';
export const serviceTermsSchema = z.object({
  scheme: z.literal('exact'),
  network: z.literal(SERVICE_NETWORK),
  asset: z.literal(SERVICE_ASSET),
  amount: z.literal(SERVICE_AMOUNT),
  payTo: z.string().regex(/^0x[a-f0-9]{64}$/),
  maxTimeoutSeconds: z.literal(300),
  extra: z.object({
    gasOwner: z.string().regex(/^0x[a-f0-9]{64}$/),
    gasBudget: z.literal('2000000'),
    quoteId: z.string().uuid(),
    instructionHash: z.string().regex(/^[a-f0-9]{64}$/),
  }),
});
export type ServiceTerms = z.infer<typeof serviceTermsSchema>;
export type ServiceChallenge = {
  x402Version: 2;
  resource: { url: string; description: string; mimeType: string };
  accepts: ServiceTerms[];
};
export const servicePayloadSchema = z.object({
  x402Version: z.literal(2),
  resource: z.object({ url: z.string().max(500) }),
  accepted: serviceTermsSchema,
  payload: z.object({
    transaction: z
      .string()
      .max(16000)
      .regex(/^[A-Za-z0-9+/=]+$/),
    signature: z
      .string()
      .max(400)
      .regex(/^[A-Za-z0-9+/=]+$/),
  }),
});
// This local allowlist is stricter than the facilitator: one destination, no arbitrary app calls.
export function validateServiceTransaction(bytes: string, terms: ServiceTerms, payer: string) {
  const d = Transaction.from(fromBase64(bytes)).getData();
  if (
    d.sender !== normalizeSuiAddress(payer) ||
    d.gasData.owner !== terms.extra.gasOwner ||
    d.gasData.payment?.length !== 0 ||
    d.gasData.budget !== terms.extra.gasBudget
  )
    throw new Error('Sender or gas terms differ from approval');
  if (d.expiration?.$kind !== 'ValidDuring' || d.expiration.ValidDuring.chain !== TESTNET_GENESIS)
    throw new Error('Transaction is not bound to Sui Testnet');
  const nonce = bcs.string().serialize(terms.extra.quoteId).toBase64();
  if (!d.inputs.some((i) => i.$kind === 'Pure' && i.Pure.bytes === nonce))
    throw new Error('Quote nonce missing from signed transaction');
  const sends = d.commands.filter(
    (c) =>
      c.$kind === 'MoveCall' &&
      c.MoveCall.module === 'balance' &&
      c.MoveCall.function === 'send_funds',
  );
  if (sends.length !== 1) throw new Error('Exactly one service payment required');
  for (const c of d.commands) {
    if (c.$kind === 'SplitCoins' || c.$kind === 'MergeCoins') continue;
    if (
      c.$kind !== 'MoveCall' ||
      normalizeSuiAddress(c.MoveCall.package) !== normalizeSuiAddress('0x2') ||
      !['balance::send_funds', 'balance::redeem_funds', 'coin::into_balance'].includes(
        c.MoveCall.module + '::' + c.MoveCall.function,
      )
    )
      throw new Error('Unexpected transaction command');
  }
  const send = sends[0];
  if (send.$kind !== 'MoveCall') throw new Error('Invalid send');
  const [balance, recipient] = send.MoveCall.arguments;
  if (
    normalizeStructTag(send.MoveCall.typeArguments[0]) !== normalizeStructTag(terms.asset) ||
    recipient?.$kind !== 'Input'
  )
    throw new Error('Asset or recipient input mismatch');
  const recipientInput = d.inputs[recipient.Input];
  if (
    recipientInput?.$kind !== 'Pure' ||
    recipientInput.Pure.bytes !== bcs.Address.serialize(terms.payTo).toBase64()
  )
    throw new Error('Recipient differs from approved terms');
  const getAmount = (arg: typeof balance): bigint => {
    if (arg.$kind === 'Input') {
      const i = d.inputs[arg.Input];
      if (
        i?.$kind === 'FundsWithdrawal' &&
        normalizeStructTag(i.FundsWithdrawal.typeArg.Balance) === normalizeStructTag(terms.asset)
      )
        return BigInt(i.FundsWithdrawal.reservation.MaxAmountU64);
      throw new Error('Invalid withdrawal');
    }
    const index =
      arg.$kind === 'Result'
        ? arg.Result
        : arg.$kind === 'NestedResult' && arg.NestedResult[1] === 0
          ? arg.NestedResult[0]
          : -1;
    const c = d.commands[index];
    if (c?.$kind === 'MoveCall' && ['redeem_funds', 'into_balance'].includes(c.MoveCall.function))
      return getAmount(c.MoveCall.arguments[0]);
    if (c?.$kind === 'SplitCoins' && c.SplitCoins.amounts.length === 1) {
      const a = c.SplitCoins.amounts[0];
      const i = a.$kind === 'Input' ? d.inputs[a.Input] : undefined;
      if (i?.$kind === 'Pure') return BigInt(bcs.u64().parse(fromBase64(i.Pure.bytes)));
    }
    throw new Error('Cannot resolve exact amount');
  };
  if (BigInt(getAmount(balance)) !== BigInt(terms.amount))
    throw new Error('Amount differs from approved cap');
  return d;
}
export function analyzeInstructionConsistency(
  invoice: { recipient: string; memo: string },
  message: string,
) {
  const addresses = [...new Set((invoice.memo + '\n' + message).match(/0x[a-fA-F0-9]{64}/g) || [])];
  const contradictions = addresses.filter(
    (a) => a.toLowerCase() !== invoice.recipient.toLowerCase(),
  );
  const urls = (message.match(/https?:\/\/[^\s<>]+/g) || []).map((u) => {
    try {
      return new URL(u).hostname;
    } catch {
      return 'unparseable';
    }
  });
  return {
    provider: 'PayGuard first-party consistency analysis',
    independentIdentityVerification: false,
    addressesMentioned: addresses.length,
    conflictingRecipientMentions: contradictions,
    linkDomains: urls,
    injectionDirective: /ignore.{0,80}(?:instructions|safety|rules)/i.test(
      message + ' ' + invoice.memo,
    ),
    recommendation: contradictions.length
      ? 'Hold: reconcile contradictory recipient references through the established supplier channel.'
      : 'Complete independent supplier verification. Consistent text cannot establish identity.',
    limitations:
      'Deterministic supplemental analysis of submitted records; no external callback, email authentication or supplier identity certification.',
  };
}
