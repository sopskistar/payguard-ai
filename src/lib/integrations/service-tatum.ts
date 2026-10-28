import 'server-only';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { credentials } from '@grpc/grpc-js';
import { normalizeGrpcTransaction } from './tatum';
import { canonicalCoin } from '../validation';
import type { ServiceTerms } from '../service-protocol';
export async function inspectServiceSettlement(digest: string, terms: ServiceTerms, payer: string) {
  if (terms.network !== 'sui:testnet' || !process.env.TATUM_API_KEY)
    throw new Error('Testnet Tatum configuration required');
  const transport = new GrpcTransport({
    host: 'sui-testnet-grpc.gateway.tatum.io:443',
    channelCredentials: credentials.createSsl(),
    meta: { 'x-api-key': process.env.TATUM_API_KEY },
    timeout: 10000,
  });
  try {
    const client = new SuiGrpcClient({ network: 'testnet', transport });
    const { response: info } = await client.ledgerService.getServiceInfo({});
    if (info.chain !== 'testnet') throw new Error('Wrong verification network');
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
      tx.transaction?.data.gasData?.owner === terms.payTo
    )
      throw new Error('Settlement evidence differs from approved service terms');
    return {
      source: 'Tatum native Sui Testnet gRPC',
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
