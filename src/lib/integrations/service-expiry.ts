import 'server-only';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { credentials } from '@grpc/grpc-js';
import type { ServiceExpiryEvidence, ServiceExpiryWindow } from '../service-expiry';
import { failedPaymentCheck } from '../service-setup';
import { pacedTatumRead } from './tatum-read';

// Fixed independent endpoints. No client-supplied providers, epochs or evidence are accepted.
export async function readServiceExpiryEvidence(window: ServiceExpiryWindow) {
  return Promise.all(
    (['tatum', 'sui-fullnode'] as const).map(async (provider) => {
      const evidence: ServiceExpiryEvidence = {
        provider,
        digest: window.digest,
        checkedAt: new Date().toISOString(),
        reads: [],
      };
      const transport = new GrpcTransport({
        host:
          provider === 'tatum'
            ? 'sui-mainnet-grpc.gateway.tatum.io:443'
            : 'fullnode.mainnet.sui.io:443',
        channelCredentials: credentials.createSsl(),
        meta: provider === 'tatum' ? { 'x-api-key': process.env.TATUM_API_KEY || '' } : {},
        timeout: 8000,
      });
      async function read<T>(stage: string, method: string, operation: () => Promise<T>) {
        let attempt = 0;
        const observed = async () => {
          attempt++;
          try {
            const result = await operation();
            evidence.reads!.push({
              stage,
              method,
              attempt,
              checkedAt: new Date().toISOString(),
              code: 'OK',
            });
            return result;
          } catch (error) {
            const raw = error as { code?: unknown; message?: unknown };
            const diagnostic = failedPaymentCheck(stage, method, error);
            const http =
              typeof raw?.message === 'string'
                ? /^Received HTTP status code (\d{3})$/.exec(raw.message)
                : null;
            const grpcCode =
              typeof raw?.code === 'string' &&
              /^(NOT_FOUND|UNAVAILABLE|DEADLINE_EXCEEDED|RESOURCE_EXHAUSTED|UNAUTHENTICATED|PERMISSION_DENIED|UNIMPLEMENTED|INTERNAL)$/.test(
                raw.code,
              )
                ? raw.code
                : undefined;
            evidence.reads!.push({
              stage,
              method,
              attempt,
              checkedAt: new Date().toISOString(),
              code: diagnostic.code,
              grpcCode,
              ...(http ? { httpStatus: Number(http[1]) } : {}),
            });
            throw error;
          }
        };
        return provider === 'tatum' ? pacedTatumRead(observed) : observed();
      }
      async function lookup(
        client: SuiGrpcClient,
        stage: 'original-transaction' | 'final-transaction',
      ) {
        let result: NonNullable<ServiceExpiryEvidence['transaction']>;
        try {
          const { response } = await read(stage, 'GetTransaction', async () =>
            client.ledgerService.getTransaction({
              digest: window.digest,
              readMask: { paths: ['digest', 'checkpoint', 'effects.status'] },
            }),
          );
          const tx = response.transaction;
          result = {
            outcome: tx?.digest === window.digest ? 'found' : 'unknown',
            checkpoint: tx?.checkpoint?.toString(),
            success: tx?.effects?.status?.success,
          };
        } catch (error) {
          const code = (error as { code?: string | number }).code;
          if (code !== 'NOT_FOUND' && code !== 5) throw error;
          result = { outcome: 'not-found' };
        }
        (evidence.transactionLookups ||= []).push({ stage, ...result });
        // Positive or incomplete evidence is sticky. A later NOT_FOUND cannot erase it.
        evidence.transaction =
          [evidence.transaction, result].find((t) => t?.outcome === 'found') ||
          [evidence.transaction, result].find((t) => t?.outcome === 'unknown') ||
          result;
      }
      try {
        if (provider === 'tatum' && !process.env.TATUM_API_KEY) throw Error('UNCONFIGURED');
        const client = new SuiGrpcClient({ network: 'mainnet', transport });
        const { response: info } = await read('identity-before', 'GetServiceInfo', async () =>
          client.ledgerService.getServiceInfo({}),
        );
        const { response: current } = await read('current-epoch', 'GetEpoch', async () =>
          client.ledgerService.getEpoch({
            readMask: {
              paths: ['epoch', 'protocol_config.protocol_version', 'protocol_config.feature_flags'],
            },
          }),
        );
        evidence.genesis = info.chain === 'mainnet' ? info.chainId : undefined;
        evidence.epoch = current.epoch?.epoch?.toString();
        evidence.protocolVersion = current.epoch?.protocolConfig?.protocolVersion?.toString();
        evidence.expirationEnabled =
          current.epoch?.protocolConfig?.featureFlags.enable_multi_epoch_transaction_expiration ===
            true &&
          current.epoch?.protocolConfig?.featureFlags.enable_address_balance_gas_payments === true;
        evidence.checkpoint = info.checkpointHeight?.toString();
        evidence.lowestCheckpoint = info.lowestAvailableCheckpoint?.toString();
        await lookup(client, 'original-transaction');
        if (evidence.epoch && BigInt(evidence.epoch) > BigInt(window.maxEpoch)) {
          const { response: first } = await read('first-valid-epoch', 'GetEpoch', async () =>
            client.ledgerService.getEpoch({
              epoch: BigInt(window.minEpoch),
              readMask: { paths: ['epoch', 'first_checkpoint'] },
            }),
          );
          const { response: last } = await read('last-valid-epoch', 'GetEpoch', async () =>
            client.ledgerService.getEpoch({
              epoch: BigInt(window.maxEpoch),
              readMask: { paths: ['epoch', 'last_checkpoint'] },
            }),
          );
          if (
            first.epoch?.epoch?.toString() !== window.minEpoch ||
            last.epoch?.epoch?.toString() !== window.maxEpoch
          )
            throw Error('EPOCH_HISTORY_MISMATCH');
          evidence.firstValidCheckpoint = first.epoch.firstCheckpoint?.toString();
          evidence.lastValidCheckpoint = last.epoch.lastCheckpoint?.toString();
          if (last.epoch.lastCheckpoint === undefined) throw Error('EPOCH_NOT_CLOSED');
          const lastCheckpoint = last.epoch.lastCheckpoint;
          const { response } = await read('closed-epoch-checkpoint', 'GetCheckpoint', async () =>
            client.ledgerService.getCheckpoint({
              checkpointId: {
                oneofKind: 'sequenceNumber',
                sequenceNumber: lastCheckpoint,
              },
              readMask: {
                paths: ['digest', 'sequence_number', 'summary.epoch', 'summary.end_of_epoch_data'],
              },
            }),
          );
          const cp = response.checkpoint;
          evidence.boundaryDigest = cp?.digest;
          evidence.boundaryEpoch = cp?.summary?.epoch?.toString();
          evidence.boundaryClosed =
            cp?.sequenceNumber === lastCheckpoint && !!cp?.summary?.endOfEpochData;
        }
        await lookup(client, 'final-transaction');
        // Confirm retention still covers the complete window after the digest read.
        const { response: after } = await read('identity-after', 'GetServiceInfo', async () =>
          client.ledgerService.getServiceInfo({}),
        );
        if (
          after.chain !== 'mainnet' ||
          after.chainId !== evidence.genesis ||
          after.checkpointHeight === undefined ||
          info.checkpointHeight === undefined ||
          after.checkpointHeight < info.checkpointHeight
        )
          throw Error('LEDGER_VIEW_CHANGED');
        evidence.checkpoint = after.checkpointHeight.toString();
        if (
          after.lowestAvailableCheckpoint === undefined ||
          info.lowestAvailableCheckpoint === undefined
        )
          throw Error('RETENTION_UNKNOWN');
        evidence.lowestCheckpoint = (
          after.lowestAvailableCheckpoint > info.lowestAvailableCheckpoint
            ? after.lowestAvailableCheckpoint
            : info.lowestAvailableCheckpoint
        ).toString();
      } catch (e) {
        // Provider messages can contain credentials/metadata. Store only classified codes.
        const code = failedPaymentCheck('', '', e).code;
        evidence.error = code === 'UNKNOWN' ? 'READ_UNCERTAIN' : code;
      } finally {
        transport.close();
      }
      // Freshness covers the whole observation, including queueing and retries.
      // Do not relabel an old epoch/digest read with the completion timestamp.
      return evidence;
    }),
  );
}
