import { z } from 'zod';
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { fromBase64, normalizeSuiAddress, normalizeStructTag } from '@mysten/sui/utils';
export const TESTNET_GENESIS = '69WiPg3DAQiwdxfncX6wYQ2siKwAe6L9BZthQea3JNMD';
export const MAINNET_GENESIS = '4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S';
export const serviceNetworkSchema = z.enum(['sui:mainnet', 'sui:testnet']);
export type ServiceNetwork = z.infer<typeof serviceNetworkSchema>;
export const SERVICE_NETWORK = 'sui:mainnet' as const;
export const SERVICE_AMOUNT = '1000000';
export const SERVICE_SESSION_CAP = '3000000';
export const SERVICE_ASSET = '0x2::sui::SUI';
export const SERVICE_DECIMALS = 9;
export const FACILITATOR = 'https://facilitator.tentaclepay.com';
export const serviceAddressSchema = z
  .string()
  .regex(/^0x[a-f0-9]{64}$/)
  .refine((a) => a !== '0x' + '0'.repeat(64), 'Zero address is not a service-payment party');
export function serviceNetworkInfo(network: ServiceNetwork) {
  return network === 'sui:mainnet'
    ? {
        name: 'Sui Mainnet',
        sdk: 'mainnet' as const,
        genesis: MAINNET_GENESIS,
        grpc: 'https://fullnode.mainnet.sui.io:443',
        tatum: 'sui-mainnet-grpc.gateway.tatum.io:443',
      }
    : {
        name: 'Sui Testnet',
        sdk: 'testnet' as const,
        genesis: TESTNET_GENESIS,
        grpc: 'https://fullnode.testnet.sui.io:443',
        tatum: 'sui-testnet-grpc.gateway.tatum.io:443',
      };
}
export const serviceTermsSchema = z
  .object({
    scheme: z.literal('exact'),
    network: serviceNetworkSchema,
    asset: z.literal(SERVICE_ASSET),
    amount: z.literal(SERVICE_AMOUNT),
    payTo: serviceAddressSchema,
    maxTimeoutSeconds: z.literal(300),
    extra: z.object({
      gasOwner: serviceAddressSchema,
      gasBudget: z.literal('2000000'),
      quoteId: z.string().uuid(),
      instructionHash: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  })
  .refine((t) => t.payTo !== t.extra.gasOwner, 'Merchant must differ from gas sponsor');
export type ServiceTerms = z.infer<typeof serviceTermsSchema>;
export type ServiceChallenge = {
  x402Version: 2;
  resource: { url: string; description: string; mimeType: string };
  accepts: ServiceTerms[];
};
export function parseServiceChallenge(
  raw: unknown,
  expectedOrigin: string,
  expectedNetwork?: ServiceNetwork,
): ServiceChallenge {
  const challenge = z
    .object({
      x402Version: z.literal(2),
      resource: z
        .object({
          url: z.string().url().max(500),
          description: z.string().max(500),
          mimeType: z.literal('application/json'),
        })
        .strict(),
      accepts: z.array(serviceTermsSchema).length(1),
    })
    .strict()
    .parse(raw);
  const resource = new URL(challenge.resource.url);
  const terms = challenge.accepts[0];
  if (
    resource.origin !== new URL(expectedOrigin).origin ||
    resource.search ||
    resource.hash ||
    resource.username ||
    resource.password ||
    resource.pathname !== '/api/service-payments/' + terms.extra.quoteId ||
    (expectedNetwork && terms.network !== expectedNetwork) ||
    terms.payTo === terms.extra.gasOwner
  )
    throw new Error('Unexpected service origin, quote or recipient');
  return challenge;
}
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
      .max(12000)
      .regex(/^[A-Za-z0-9+/=]+$/),
  }),
});
export function encodeServicePaymentHeader(raw: unknown) {
  const payload = servicePayloadSchema.parse(raw);
  const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload))));
  if (encoded.length > 12000)
    throw new Error('Payment signature exceeds the HTTP header limit. No transaction submitted.');
  return encoded;
}
export function decodeServicePaymentHeader(encoded: string) {
  if (!encoded || encoded.length > 12000 || !/^[A-Za-z0-9+/=]+$/.test(encoded))
    throw new Error('Invalid PAYMENT-SIGNATURE header');
  return servicePayloadSchema.parse(
    JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)))),
  );
}
// Complete unsigned transaction shared by the browser and non-spending audits.
// No wallet, RPC execution or automatic coin-selection intent is involved.
export function buildServiceTransaction(
  terms: ServiceTerms,
  payer: string,
  state: { genesis: string; epoch: string | number; gasPrice: string; nonce: number },
) {
  serviceTermsSchema.parse(terms);
  serviceAddressSchema.parse(payer);
  if (
    state.genesis !== serviceNetworkInfo(terms.network).genesis ||
    !/^\d+$/.test(String(state.epoch)) ||
    !/^[1-9]\d*$/.test(state.gasPrice) ||
    !Number.isSafeInteger(Number(state.epoch)) ||
    !Number.isInteger(state.nonce) ||
    state.nonce < 0 ||
    state.nonce > 0xffffffff ||
    payer === terms.payTo ||
    payer === terms.extra.gasOwner
  )
    throw new Error('Unverified network, epoch, gas price, nonce or payer');
  const tx = new Transaction();
  tx.setSender(payer);
  const balance = tx.moveCall({
    target: '0x2::balance::redeem_funds',
    typeArguments: [terms.asset],
    arguments: [tx.withdrawal({ type: terms.asset, amount: BigInt(terms.amount) })],
  });
  tx.moveCall({
    target: '0x2::balance::send_funds',
    typeArguments: [terms.asset],
    arguments: [balance, tx.pure.address(terms.payTo)],
  });
  tx.pure.string(terms.extra.quoteId);
  const epoch = Number(state.epoch);
  tx.setExpiration({
    ValidDuring: {
      chain: state.genesis,
      minEpoch: epoch,
      maxEpoch: epoch + 1,
      minTimestamp: null,
      maxTimestamp: null,
      nonce: state.nonce,
    },
  });
  tx.setGasOwner(terms.extra.gasOwner);
  tx.setGasBudget(terms.extra.gasBudget);
  tx.setGasPrice(state.gasPrice);
  tx.setGasPayment([]);
  return tx;
}
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
  if (
    d.expiration?.$kind !== 'ValidDuring' ||
    d.expiration.ValidDuring.chain !== serviceNetworkInfo(terms.network).genesis
  )
    throw new Error('Transaction is not bound to the approved Sui network');
  if (
    normalizeSuiAddress(payer) === terms.extra.gasOwner ||
    normalizeSuiAddress(payer) === terms.payTo
  )
    throw new Error('Payer must differ from merchant and sponsor');
  const validity = d.expiration.ValidDuring;
  if (validity.minTimestamp != null || validity.maxTimestamp != null)
    throw new Error('Timestamp-based Sui expiration is unsupported; use the approved epoch window');
  if (
    validity.minEpoch == null ||
    validity.maxEpoch == null ||
    BigInt(validity.maxEpoch) - BigInt(validity.minEpoch) !== 1n
  )
    throw new Error('Payment must expire within one epoch');
  let withdrawals = 0n;
  for (const input of d.inputs) {
    if (input.$kind !== 'Pure' && input.$kind !== 'FundsWithdrawal')
      throw new Error('Service payment cannot access arbitrary objects');
    if (input.$kind === 'FundsWithdrawal') {
      const w = input.FundsWithdrawal;
      if (
        w.withdrawFrom.$kind !== 'Sender' ||
        normalizeStructTag(w.typeArg.Balance) !== normalizeStructTag(terms.asset)
      )
        throw new Error('Only approved payer/asset withdrawals are allowed');
      withdrawals += BigInt(w.reservation.MaxAmountU64);
    }
  }
  if (withdrawals > BigInt(terms.amount)) throw new Error('Withdrawals exceed the approved cap');
  if (withdrawals !== BigInt(terms.amount)) throw new Error('Exact sender withdrawal required');
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
  const redeem = d.commands[0],
    last = d.commands[1];
  if (
    d.commands.length !== 2 ||
    redeem?.$kind !== 'MoveCall' ||
    redeem.MoveCall.module !== 'balance' ||
    redeem.MoveCall.function !== 'redeem_funds' ||
    last?.$kind !== 'MoveCall' ||
    last.MoveCall.module !== 'balance' ||
    last.MoveCall.function !== 'send_funds'
  )
    throw new Error('Unexpected payment template: redeem the withdrawal, then send its balance');
  const withdrawalArg = redeem.MoveCall.arguments[0];
  if (
    withdrawalArg?.$kind !== 'Input' ||
    d.inputs[withdrawalArg.Input]?.$kind !== 'FundsWithdrawal'
  )
    throw new Error('Redemption must consume the approved sender withdrawal');
  const balanceArg = last.MoveCall.arguments[0];
  if (
    !balanceArg ||
    !(
      (balanceArg.$kind === 'Result' && balanceArg.Result === 0) ||
      (balanceArg.$kind === 'NestedResult' &&
        balanceArg.NestedResult[0] === 0 &&
        balanceArg.NestedResult[1] === 0)
    )
  )
    throw new Error('Send must consume the exact redeemed balance');
  for (const c of d.commands) {
    const args =
      c.$kind === 'MoveCall'
        ? c.MoveCall.arguments
        : c.$kind === 'SplitCoins'
          ? [c.SplitCoins.coin, ...c.SplitCoins.amounts]
          : c.$kind === 'MergeCoins'
            ? [c.MergeCoins.destination, ...c.MergeCoins.sources]
            : [];
    if (args.some((a) => a.$kind === 'GasCoin'))
      throw new Error('Service commands cannot spend sponsor gas');
    if (c.$kind === 'SplitCoins' || c.$kind === 'MergeCoins') continue;
    if (
      c.$kind !== 'MoveCall' ||
      normalizeSuiAddress(c.MoveCall.package) !== normalizeSuiAddress('0x2') ||
      !['balance::send_funds', 'balance::redeem_funds', 'coin::into_balance'].includes(
        c.MoveCall.module + '::' + c.MoveCall.function,
      )
    )
      throw new Error('Unexpected transaction command');
    if (
      c.MoveCall.typeArguments.length !== 1 ||
      normalizeStructTag(c.MoveCall.typeArguments[0]) !== normalizeStructTag(terms.asset) ||
      c.MoveCall.arguments.length !== (c.MoveCall.function === 'send_funds' ? 2 : 1)
    )
      throw new Error('Unexpected payment command arguments or asset');
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
  const seen = new Set<number>();
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
    if (seen.has(index)) throw new Error('Cyclic payment command reference');
    seen.add(index);
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
