import 'server-only';
import { SuiGrpcClient } from '@mysten/sui/grpc';
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
export async function serviceChainPreflight(networkId: ServiceNetwork) {
  if (!process.env.TATUM_API_KEY) throw new Error('TATUM_API_KEY configuration required');
  const network = serviceNetworkInfo(networkId);
  const transport = new GrpcTransport({
    host: network.tatum,
    channelCredentials: credentials.createSsl(),
    meta: { 'x-api-key': process.env.TATUM_API_KEY },
    timeout: 10000,
  });
  try {
    const client = new SuiGrpcClient({ network: network.sdk, transport });
    const { response: info } = await client.ledgerService.getServiceInfo({});
    const { response: coin } = await client.stateService.getCoinInfo({ coinType: SERVICE_ASSET });
    if (
      info.chain !== network.sdk ||
      info.chainId !== network.genesis ||
      canonicalCoin(coin.coinType || '') !== canonicalCoin(SERVICE_ASSET) ||
      coin.metadata?.decimals !== SERVICE_DECIMALS
    )
      throw new Error('Network identity or native SUI metadata mismatch');
    return {
      source: 'Tatum native Sui gRPC',
      network: networkId,
      genesis: info.chainId,
      checkpoint: info.checkpointHeight?.toString(),
      coinType: SERVICE_ASSET,
      decimals: coin.metadata.decimals,
      checkedAt: new Date().toISOString(),
      spending: false,
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
