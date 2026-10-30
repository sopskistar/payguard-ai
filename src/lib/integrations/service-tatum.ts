import 'server-only';
import { SuiGrpcClient, type GrpcTypes } from '@mysten/sui/grpc';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { credentials } from '@grpc/grpc-js';
import { normalizeGrpcTransaction, type ChainTransaction } from './tatum';
import { canonicalCoin } from '../validation';
import type { ServiceTerms } from '../service-protocol';
import {
  serviceNetworkInfo,
  SERVICE_ASSET,
  SERVICE_DECIMALS,
  type ServiceNetwork,
} from '../service-protocol';
import { AppError } from '../errors';
import {
  PaymentCheckError,
  paymentCheck,
  failedPaymentCheck,
  type PaymentDiagnostic,
} from '../service-setup';

// Read-only preflight calls share a conservative two-starts/second queue per
// server process. No transaction verification, signing or settlement uses it.
let readQueue: Promise<unknown> = Promise.resolve();
let nextReadAt = 0;
async function pacedTatumRead<T>(operation: () => Promise<T>): Promise<T> {
  const turn = readQueue.then(async () => {
    const delay = Math.max(0, nextReadAt - Date.now());
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    nextReadAt = Date.now() + 500;
    try {
      return await operation();
    } catch (error) {
      if (failedPaymentCheck('', '', error).classification !== 'rate_limit') throw error;
      // A different instance or read path can share the provider key. Permit
      // one cooled-down READ retry; persistent quotas remain visible failures.
      await new Promise((resolve) => setTimeout(resolve, 1100));
      nextReadAt = Date.now() + 500;
      return operation();
    }
  });
  readQueue = turn.then(
    () => undefined,
    () => undefined,
  );
  return turn;
}

export function parseServiceBalance(b: GrpcTypes.Balance | undefined) {
  if (!b || b.balance == null || canonicalCoin(b.coinType || '') !== canonicalCoin(SERVICE_ASSET))
    throw new PaymentCheckError('BALANCE_MISSING');
  const total = b.balance;
  let coins = b.coinBalance,
    address = b.addressBalance;
  let derivation = 'Explicit total and both components';
  if (coins == null && address == null) {
    if (total !== 0n) throw new PaymentCheckError('BALANCE_COMPONENTS');
    coins = 0n;
    address = 0n;
    derivation = 'Both components proven zero by the explicit zero total';
  } else if (coins == null) {
    coins = total - address!;
    derivation = 'Coin balance derived from explicit total minus address balance';
  } else if (address == null) {
    address = total - coins;
    derivation = 'Address balance derived from explicit total minus coin balance';
  }
  if (total < 0n || coins < 0n || address! < 0n || coins + address! !== total)
    throw new PaymentCheckError('BALANCE_INCONSISTENT');
  return {
    totalAtomic: total.toString(),
    coinAtomic: coins.toString(),
    addressAtomic: address!.toString(),
    derivation,
  };
}
export type ServiceWalletBalance = ReturnType<typeof parseServiceBalance> & {
  owner: string;
  checkedAt: string;
};
export async function serviceChainPreflight(
  networkId: ServiceNetwork,
  parties: { payer?: string | null; recipient?: string | null } = {},
  options: { allowPartial?: boolean } = {},
) {
  const diagnostics: PaymentDiagnostic[] = [];
  const network = serviceNetworkInfo(networkId);
  const transport = new GrpcTransport({
    host: network.tatum,
    channelCredentials: credentials.createSsl(),
    meta: process.env.TATUM_API_KEY ? { 'x-api-key': process.env.TATUM_API_KEY } : {},
    timeout: 10000,
  });
  try {
    const client = new SuiGrpcClient({ network: network.sdk, transport });
    const info = await paymentCheck(
      diagnostics,
      'tatum.connection',
      'Tatum native gRPC connection and authentication',
      async () => {
        if (!process.env.TATUM_API_KEY) throw new PaymentCheckError('CONFIGURATION');
        return pacedTatumRead(async () => (await client.ledgerService.getServiceInfo({})).response);
      },
    );
    const identity =
      info &&
      (await paymentCheck(diagnostics, 'tatum.chain', 'Sui Mainnet chain identity', async () => {
        if (info.chain !== network.sdk || info.chainId !== network.genesis)
          throw new PaymentCheckError('CHAIN_IDENTITY');
        return true;
      }));
    const coin =
      identity &&
      (await paymentCheck(
        diagnostics,
        'tatum.native_sui',
        'Native SUI identity and units',
        async () => {
          const response = await pacedTatumRead(
            async () =>
              (await client.stateService.getCoinInfo({ coinType: SERVICE_ASSET })).response,
          );
          if (
            canonicalCoin(response.coinType || '') !== canonicalCoin(SERVICE_ASSET) ||
            response.metadata?.decimals !== SERVICE_DECIMALS
          )
            throw new PaymentCheckError('NATIVE_SUI');
          return response;
        },
      ));
    const feature =
      identity &&
      (await paymentCheck(
        diagnostics,
        'tatum.protocol',
        'Address-balance gas protocol feature',
        async () => {
          const response = await pacedTatumRead(
            async () =>
              (
                await client.ledgerService.getEpoch({
                  readMask: { paths: ['protocol_config.feature_flags'] },
                })
              ).response,
          );
          if (
            response.epoch?.protocolConfig?.featureFlags['enable_address_balance_gas_payments'] !==
            true
          )
            throw new PaymentCheckError('PROTOCOL_FEATURE');
          return true;
        },
      ));
    for (const [stage, label] of [
      ['tatum.chain', 'Sui network identity'],
      ['tatum.native_sui', 'Native SUI identity and units'],
      ['tatum.protocol', 'Address-balance gas protocol feature'],
    ]) {
      if (!diagnostics.some((d) => d.stage === stage))
        diagnostics.push({
          stage,
          label,
          status: 'skipped',
          checkedAt: new Date().toISOString(),
          classification: 'prerequisite',
          code: 'PREREQUISITE',
          message: 'A successful Tatum connection and verified chain are required.',
          action: 'Resolve the earlier Tatum stage and retry.',
        });
    }
    const balance = async (owner?: string | null) => {
      if (!owner) return null;
      const response = await pacedTatumRead(
        async () =>
          (await client.stateService.getBalance({ owner, coinType: SERVICE_ASSET })).response,
      );
      return {
        owner,
        ...parseServiceBalance(response.balance),
        checkedAt: new Date().toISOString(),
      };
    };
    const [payer, recipient] = await Promise.all([
      ...(['payer', 'recipient'] as const).map((role) => {
        const stage = 'balance.' + role,
          label = role === 'payer' ? 'Wallet A native SUI balance' : 'Wallet B native SUI balance';
        if (!coin || !parties[role]) {
          diagnostics.push({
            stage,
            label,
            status: 'skipped',
            checkedAt: new Date().toISOString(),
            classification: 'prerequisite',
            code: 'PREREQUISITE',
            message: !parties[role]
              ? 'Public address is not configured.'
              : 'A verified network and native SUI identity are required before reporting balances.',
            action: 'Resolve the earlier configuration or Tatum check, then retry.',
          });
          return Promise.resolve(null);
        }
        return paymentCheck(diagnostics, stage, label, () => balance(parties[role]));
      }),
    ]);
    if (!options.allowPartial && diagnostics.some((d) => d.status === 'failed'))
      throw new PaymentCheckError(diagnostics.find((d) => d.status === 'failed')!.code);
    return {
      source: 'Tatum native Sui gRPC',
      network: networkId,
      genesis: identity ? info!.chainId : null,
      checkpoint: identity ? info!.checkpointHeight?.toString() : null,
      coinType: coin ? SERVICE_ASSET : null,
      decimals: coin ? SERVICE_DECIMALS : null,
      checkedAt: new Date().toISOString(),
      spending: false,
      addressBalanceGasEnabled: feature === true,
      balances: { payer, recipient },
      diagnostics,
    };
  } finally {
    transport.close();
  }
}
export async function inspectServiceSettlement(digest: string, terms: ServiceTerms, payer: string) {
  if (!process.env.TATUM_API_KEY) throw new Error('TATUM_API_KEY configuration required');
  const network = serviceNetworkInfo(terms.network);
  const transport = new GrpcTransport({
    host: network.tatum,
    channelCredentials: credentials.createSsl(),
    meta: { 'x-api-key': process.env.TATUM_API_KEY },
    timeout: 10000,
  });
  try {
    const client = new SuiGrpcClient({ network: network.sdk, transport });
    const { response: info } = await client.ledgerService.getServiceInfo({});
    if (info.chain !== network.sdk || info.chainId !== network.genesis)
      throw new Error('Wrong verification network');
    const { response } = await client.ledgerService.getTransaction({
      digest,
      readMask: {
        paths: [
          'digest',
          'effects.status',
          'transaction.sender',
          'transaction.gas_payment',
          'balance_changes',
          'checkpoint',
        ],
      },
    });
    if (!response.transaction) throw new Error('No finalized transaction');
    const tx = normalizeGrpcTransaction(response.transaction);
    const credit = validateServiceSettlement(tx, digest, terms, payer);
    return {
      source: `Tatum native ${network.name} gRPC`,
      genesis: info.chainId,
      network: terms.network,
      checkedAt: new Date().toISOString(),
      digest,
      checkpoint: tx.checkpoint,
      receivedAtomic: credit.toString(),
      transaction: tx,
    };
  } finally {
    transport.close();
  }
}

export function validateServiceSettlement(
  tx: ChainTransaction,
  digest: string,
  terms: ServiceTerms,
  payer: string,
) {
  if (tx.checkpoint && tx.effects?.status.status === 'failure')
    throw new AppError(
      409,
      'SETTLEMENT_FAILED',
      'Tatum confirmed that the service transaction failed. No service receipt was created.',
    );
  const credit = (tx.balanceChanges || [])
    .filter(
      (c) =>
        typeof c.owner === 'object' &&
        'AddressOwner' in c.owner &&
        c.owner.AddressOwner === terms.payTo &&
        canonicalCoin(c.coinType) === canonicalCoin(terms.asset),
    )
    .reduce((n, c) => n + BigInt(c.amount), 0n);
  if (
    tx.digest !== digest ||
    !tx.checkpoint ||
    tx.effects?.status.status !== 'success' ||
    tx.transaction?.data.sender !== payer ||
    credit !== BigInt(terms.amount) ||
    payer === terms.payTo ||
    tx.transaction?.data.gasData?.owner !== terms.extra.gasOwner ||
    tx.transaction?.data.gasData?.owner === terms.payTo
  )
    throw new Error('Settlement evidence differs from approved service terms');
  return credit;
}
