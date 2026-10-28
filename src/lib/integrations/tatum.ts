import 'server-only';
import { SuiGrpcClient, type GrpcTypes } from '@mysten/sui/grpc';
import { fromBase58 } from '@mysten/sui/utils';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { credentials } from '@grpc/grpc-js';
import { z } from 'zod';
import { address, canonicalCoin, digestSchema, units } from '../validation';
import type { Invoice } from '../types';
import { AppError, unavailable } from '../errors';
export const TATUM_URL = 'https://sui-mainnet-grpc.gateway.tatum.io';
export const MAINNET_CHAIN_ID = '35834a8a';
const balanceChange = z.object({
  owner: z.union([
    z.object({ AddressOwner: z.string() }),
    z.object({ ObjectOwner: z.string() }),
    z.string(),
  ]),
  coinType: z.string(),
  amount: z.string().regex(/^-?\d+$/),
});
export const transactionSchema = z.object({
  digest: digestSchema,
  effects: z
    .object({
      status: z.object({ status: z.string(), error: z.string().optional() }),
      gasObject: z.object({ owner: z.unknown() }).optional(),
    })
    .optional(),
  balanceChanges: z.array(balanceChange).optional(),
  transaction: z
    .object({
      data: z.object({ sender: z.string(), gasData: z.object({ owner: z.string() }).optional() }),
    })
    .optional(),
  timestampMs: z.string().optional(),
  checkpoint: z.string().optional(),
  errors: z.array(z.string()).optional(),
});
export type ChainTransaction = z.infer<typeof transactionSchema>;
export type Verification = {
  status: 'Confirmed match' | 'Mismatch' | 'Needs review' | 'Unverified' | 'Conflict';
  digest: string;
  network: string;
  chainId: string;
  criteria: { label: string; passed: boolean | null; detail: string }[];
  transaction: ChainTransaction;
  decimals: number | null;
  expectedAtomic: string | null;
  receivedAtomic: string;
  explorer: string;
  checkedAt: string;
};
const READ_MASK = {
  paths: [
    'digest',
    'transaction.sender',
    'transaction.gas_payment',
    'effects.status',
    'balance_changes',
    'checkpoint',
    'timestamp',
  ],
};
export function normalizeGrpcTransaction(tx: GrpcTypes.ExecutedTransaction): ChainTransaction {
  const result = transactionSchema.safeParse({
    digest: tx.digest,
    effects:
      typeof tx.effects?.status?.success === 'boolean'
        ? { status: { status: tx.effects.status.success ? 'success' : 'failure' } }
        : undefined,
    balanceChanges: tx.balanceChanges?.map((c) => ({
      owner: { AddressOwner: c.address },
      coinType: c.coinType,
      amount: c.amount,
    })),
    transaction: tx.transaction?.sender
      ? {
          data: {
            sender: tx.transaction.sender,
            gasData: tx.transaction.gasPayment?.owner
              ? { owner: tx.transaction.gasPayment.owner }
              : undefined,
          },
        }
      : undefined,
    checkpoint: tx.checkpoint?.toString(),
    timestampMs: tx.timestamp
      ? (tx.timestamp.seconds * 1000n + BigInt(Math.floor(tx.timestamp.nanos / 1000000))).toString()
      : undefined,
  });
  if (!result.success)
    throw new AppError(
      502,
      'GRPC_SCHEMA',
      'Tatum gRPC returned incomplete transaction fields; verification stopped.',
    );
  return result.data;
}
export function mainnetIdentifier(genesisDigest: string | undefined, chain: string | undefined) {
  let id = '';
  try {
    const bytes = fromBase58(genesisDigest || '');
    if (bytes.length === 32) id = Buffer.from(bytes.subarray(0, 4)).toString('hex');
  } catch {
    /* Fail closed. */
  }
  if (id !== MAINNET_CHAIN_ID || chain?.toLowerCase() !== 'mainnet')
    throw new AppError(
      502,
      'WRONG_NETWORK',
      'Tatum gRPC did not identify Sui Mainnet. Verification stopped.',
    );
  return id;
}
export function grpcFailure(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const code = (error as { code?: string | number })?.code;
  const names: Record<string, string> = {
    UNAUTHENTICATED: 'API key rejected. Check TATUM_API_KEY.',
    PERMISSION_DENIED: 'API key lacks Sui Mainnet gRPC access.',
    NOT_FOUND: 'Requested data was not found or was pruned.',
    UNIMPLEMENTED: 'This gRPC method is unavailable on the provider. No legacy fallback is used.',
    RESOURCE_EXHAUSTED: 'Provider rate limit reached. Wait before retrying.',
    DEADLINE_EXCEEDED: 'Provider timed out; no result was verified.',
    UNAVAILABLE: 'Tatum gRPC is unavailable; no result was verified.',
  };
  return new AppError(
    code === 'RESOURCE_EXHAUSTED' ? 429 : 502,
    'GRPC_UNAVAILABLE',
    names[String(code)] || 'Tatum gRPC failed. No chain result was verified.',
  );
}
async function withGrpc<T>(work: (client: SuiGrpcClient) => Promise<T>): Promise<T> {
  if (!process.env.TATUM_API_KEY) unavailable('Tatum Sui Mainnet gRPC');
  for (let attempt = 0; attempt < 2; attempt++) {
    const transport = new GrpcTransport({
      host: 'sui-mainnet-grpc.gateway.tatum.io:443',
      channelCredentials: credentials.createSsl(),
      meta: { 'x-api-key': process.env.TATUM_API_KEY },
      timeout: 12000,
      clientOptions: { 'grpc.max_receive_message_length': 8 * 1024 * 1024 },
    });
    const client = new SuiGrpcClient({ network: 'mainnet', transport });
    try {
      return await work(client);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (attempt === 0 && ['UNAVAILABLE', 'DEADLINE_EXCEEDED'].includes(code || '')) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      throw grpcFailure(error);
    } finally {
      transport.close();
    }
  }
  throw new AppError(502, 'GRPC_UNAVAILABLE', 'Tatum gRPC is unavailable.');
}
async function health(client: SuiGrpcClient) {
  const { response } = await client.ledgerService.getServiceInfo({});
  const chainId = mainnetIdentifier(response.chainId, response.chain);
  if (response.checkpointHeight === undefined)
    throw new AppError(502, 'GRPC_SCHEMA', 'Provider did not return its latest checkpoint.');
  return {
    chainId,
    genesisDigest: response.chainId,
    checkpoint: response.checkpointHeight.toString(),
    network: 'Sui Mainnet',
    transport: 'native gRPC over HTTP/2 + TLS',
    endpoint: TATUM_URL,
    checkedAt: new Date().toISOString(),
  };
}
export async function chainHealth() {
  return withGrpc(health);
}
async function inspect(
  client: SuiGrpcClient,
  digest: string,
  knownInfo?: Awaited<ReturnType<typeof health>>,
) {
  digestSchema.parse(digest);
  const info = knownInfo || (await health(client));
  const { response } = await client.ledgerService.getTransaction({ digest, readMask: READ_MASK });
  if (!response.transaction) throw new AppError(502, 'GRPC_SCHEMA', 'Transaction not returned.');
  const transaction = normalizeGrpcTransaction(response.transaction);
  if (transaction.digest !== digest)
    throw new AppError(502, 'DIGEST_MISMATCH', 'Provider returned a different digest.');
  return { ...info, transaction, explorer: `https://suiscan.xyz/mainnet/tx/${digest}` };
}
export async function inspectTransaction(digest: string) {
  return withGrpc((client) => inspect(client, digest));
}
export function reconcile(
  invoice: Invoice,
  tx: ChainTransaction,
  decimals: number | null,
  chainId: string,
  claimed = false,
): Verification {
  const criteria: Verification['criteria'] = [];
  const add = (label: string, passed: boolean | null, detail: string) =>
    criteria.push({ label, passed, detail });
  add('Sui Mainnet', chainId === MAINNET_CHAIN_ID, chainId);
  add(
    'Finalized checkpoint',
    tx.checkpoint && /^\d+$/.test(tx.checkpoint) ? true : null,
    tx.checkpoint || 'Checkpoint unavailable',
  );
  add(
    'Successful execution',
    tx.effects ? tx.effects.status.status === 'success' : null,
    tx.effects?.status.status || 'Effects unavailable',
  );
  add(
    'Complete balance evidence',
    tx.balanceChanges && !tx.errors?.length ? true : null,
    tx.errors?.length ? 'Provider returned partial data' : 'Balance changes requested from chain',
  );
  const recipient = invoice.recipient.toLowerCase();
  const sender = tx.transaction?.data.sender.toLowerCase();
  const gasOwner = tx.transaction?.data.gasData?.owner.toLowerCase();
  add('Intended recipient', recipient ? true : null, recipient || 'Recipient missing');
  add(
    'Recipient is distinct from sender and gas payer',
    !recipient || !sender || !gasOwner ? null : recipient !== sender && recipient !== gasOwner,
    'Sender/gas-payer net changes can include rebates and are not accepted as payment evidence.',
  );
  add(
    'Agreed coin and amount',
    invoice.coinType && invoice.tokenAmount ? true : null,
    invoice.tokenAmount
      ? `${invoice.tokenAmount} ${invoice.coinType}`
      : 'Set the agreed token amount. No fiat/token conversion is assumed.',
  );
  add(
    'Coin decimals',
    decimals !== null ? true : null,
    decimals === null ? 'Coin metadata unavailable' : String(decimals),
  );
  let expected: bigint | null = null;
  if (invoice.tokenAmount && decimals !== null) {
    try {
      expected = units(invoice.tokenAmount, decimals);
    } catch {
      add('Token precision', false, 'Agreed amount cannot be represented in this token.');
    }
  }
  const received = (tx.balanceChanges || [])
    .filter(
      (c) =>
        typeof c.owner === 'object' &&
        'AddressOwner' in c.owner &&
        c.owner.AddressOwner.toLowerCase() === recipient &&
        canonicalCoin(c.coinType) === canonicalCoin(invoice.coinType),
    )
    .reduce((n, c) => n + BigInt(c.amount), 0n);
  add(
    'Exact positive recipient credit',
    expected === null || !tx.balanceChanges ? null : received > 0n && received === expected,
    `Received ${received.toString()} atomic units; expected ${expected?.toString() ?? 'unknown'}. Over/underpayments require review.`,
  );
  add(
    'Unique invoice match',
    !claimed,
    claimed
      ? 'Digest is already assigned to another invoice.'
      : 'Uniqueness is enforced again when saving.',
  );
  const status = claimed
    ? 'Conflict'
    : criteria.some((c) => c.passed === null)
      ? 'Needs review'
      : criteria.some((c) => c.passed === false)
        ? 'Mismatch'
        : 'Confirmed match';
  return {
    status,
    digest: tx.digest,
    network: 'Sui Mainnet',
    chainId,
    criteria,
    transaction: tx,
    decimals,
    expectedAtomic: expected?.toString() ?? null,
    receivedAtomic: received.toString(),
    explorer: `https://suiscan.xyz/mainnet/tx/${tx.digest}`,
    checkedAt: new Date().toISOString(),
  };
}
export async function verifyInvoice(invoice: Invoice, digest: string, claimed = false) {
  return withGrpc(async (client) => {
    const inspection = await inspect(client, digest);
    let decimals: number | null = null;
    if (invoice.coinType) {
      const { response } = await client.stateService.getCoinInfo({ coinType: invoice.coinType });
      if (response.coinType && canonicalCoin(response.coinType) !== canonicalCoin(invoice.coinType))
        throw new AppError(
          502,
          'COIN_MISMATCH',
          'Provider returned metadata for a different coin.',
        );
      decimals = response.metadata?.decimals ?? null;
      if (decimals !== null && (!Number.isInteger(decimals) || decimals < 0 || decimals > 38))
        throw new AppError(502, 'COIN_PRECISION', 'Provider returned unsupported coin precision.');
    }
    return reconcile(invoice, inspection.transaction, decimals, inspection.chainId, claimed);
  });
}
export async function watchWallet(
  owner: string,
  cursor: string | null = null,
  direction: 'incoming' | 'outgoing' = 'incoming',
) {
  address.parse(owner);
  if (cursor && !/^[A-Za-z0-9+/=]{1,2048}$/.test(cursor))
    throw new AppError(400, 'CURSOR', 'Invalid gRPC cursor.');
  return withGrpc(async (client) => {
    const info = await health(client);
    const { response } = await client.stateService.getBalance({ owner, coinType: '0x2::sui::SUI' });
    if (response.balance?.balance === undefined)
      throw new AppError(502, 'GRPC_SCHEMA', 'Balance not returned.');
    const transactions: ChainTransaction[] = [];
    let nextCursor: string | null = null;
    let terminal: number | undefined;
    let activityStatus = 'Available';
    try {
      const call = client.ledgerService.listTransactions({
        readMask: READ_MASK,
        filter: {
          terms: [
            {
              literals: [
                {
                  negated: false,
                  predicate:
                    direction === 'outgoing'
                      ? { oneofKind: 'sender', sender: { address: owner } }
                      : { oneofKind: 'affectedAddress', affectedAddress: { address: owner } },
                },
              ],
            },
          ],
        },
        options: {
          limit: 20,
          ordering: 1,
          before: cursor ? Buffer.from(cursor, 'base64') : undefined,
        },
      });
      for await (const frame of call.responses) {
        if (frame.watermark?.cursor)
          nextCursor = Buffer.from(frame.watermark.cursor).toString('base64');
        if (frame.transaction) {
          const tx = normalizeGrpcTransaction(frame.transaction);
          if (
            direction === 'outgoing' ||
            tx.balanceChanges?.some(
              (c) =>
                typeof c.owner === 'object' &&
                'AddressOwner' in c.owner &&
                c.owner.AddressOwner.toLowerCase() === owner &&
                BigInt(c.amount) > 0n,
            )
          )
            transactions.push(tx);
        }
        if (frame.end) terminal = frame.end.reason;
      }
      if (terminal === undefined)
        throw new AppError(
          502,
          'GRPC_STREAM',
          'Transaction stream ended without a terminal frame.',
        );
    } catch (error) {
      transactions.length = 0;
      nextCursor = null;
      activityStatus = grpcFailure(error).message;
    }
    return {
      ...info,
      balance: { coinType: '0x2::sui::SUI', totalBalance: response.balance.balance.toString() },
      transactions: {
        data: transactions,
        nextCursor,
        hasNextPage: (terminal === 1 || terminal === 2) && !!nextCursor,
      },
      direction,
      activityStatus,
    };
  });
}
// Read-only evidence discovery: no relationship to an owner invoice is inferred.
export async function inspectLatestTransaction() {
  return withGrpc(async (client) => {
    // Query a settled checkpoint: the service tip can precede archival transaction availability.
    const info = await health(client);
    const { response } = await client.ledgerService.getCheckpoint({
      checkpointId: {
        oneofKind: 'sequenceNumber',
        sequenceNumber: BigInt(info.checkpoint) > 10n ? BigInt(info.checkpoint) - 10n : 0n,
      },
      readMask: { paths: ['sequence_number', 'transactions.digest'] },
    });
    const candidates = (response.checkpoint?.transactions || [])
      .filter((tx) => tx.digest)
      .slice(0, 5);
    if (!candidates.length)
      throw new AppError(
        502,
        'NO_TRANSACTION',
        'Checkpoint did not include an inspectable digest.',
      );
    let inspected: Awaited<ReturnType<typeof inspect>> | undefined;
    for (const candidate of candidates) {
      inspected = await inspect(client, candidate.digest!, info);
      const sender = inspected.transaction.transaction?.data.sender;
      if (
        inspected.transaction.balanceChanges?.some(
          (c) =>
            typeof c.owner === 'object' &&
            'AddressOwner' in c.owner &&
            c.owner.AddressOwner !== sender &&
            BigInt(c.amount) > 0n,
        )
      )
        break;
    }
    return {
      ...inspected!,
      purpose:
        'Public chain inspection only. This transaction is not linked to a supplier invoice.',
    };
  });
}
