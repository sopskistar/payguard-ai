import 'server-only';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { credentials } from '@grpc/grpc-js';
import type { ServiceExpiryEvidence, ServiceExpiryWindow } from '../service-expiry';

// Fixed independent endpoints. No client-supplied providers, epochs or evidence are accepted.
export async function readServiceExpiryEvidence(window: ServiceExpiryWindow) {
  return Promise.all(
    (['tatum', 'sui-fullnode'] as const).map(async (provider) => {
      const evidence: ServiceExpiryEvidence = {
        provider,
        digest: window.digest,
        checkedAt: new Date().toISOString(),
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
      try {
        if (provider === 'tatum' && !process.env.TATUM_API_KEY) throw Error('UNCONFIGURED');
        const client = new SuiGrpcClient({ network: 'mainnet', transport });
        const { response: info } = await client.ledgerService.getServiceInfo({});
        const { response: current } = await client.ledgerService.getEpoch({
          readMask: {
            paths: ['epoch', 'protocol_config.protocol_version', 'protocol_config.feature_flags'],
          },
        });
        evidence.genesis = info.chain === 'mainnet' ? info.chainId : undefined;
        evidence.epoch = current.epoch?.epoch?.toString();
        evidence.protocolVersion = current.epoch?.protocolConfig?.protocolVersion?.toString();
        evidence.expirationEnabled =
          current.epoch?.protocolConfig?.featureFlags.enable_multi_epoch_transaction_expiration ===
            true &&
          current.epoch?.protocolConfig?.featureFlags.enable_address_balance_gas_payments === true;
        evidence.checkpoint = info.checkpointHeight?.toString();
        evidence.lowestCheckpoint = info.lowestAvailableCheckpoint?.toString();
        try {
          const { response } = await client.ledgerService.getTransaction({
            digest: window.digest,
            readMask: { paths: ['digest', 'checkpoint', 'effects.status'] },
          });
          const tx = response.transaction;
          evidence.transaction = {
            outcome: tx?.digest === window.digest ? 'found' : 'unknown',
            checkpoint: tx?.checkpoint?.toString(),
            success: tx?.effects?.status?.success,
          };
        } catch (e) {
          const code = (e as { code?: string | number }).code;
          if (code !== 'NOT_FOUND' && code !== 5) throw e;
          evidence.transaction = { outcome: 'not-found' };
        }
        if (evidence.epoch && BigInt(evidence.epoch) > BigInt(window.maxEpoch)) {
          const [{ response: first }, { response: last }] = await Promise.all([
            client.ledgerService.getEpoch({
              epoch: BigInt(window.minEpoch),
              readMask: { paths: ['epoch', 'first_checkpoint'] },
            }),
            client.ledgerService.getEpoch({
              epoch: BigInt(window.maxEpoch),
              readMask: { paths: ['epoch', 'last_checkpoint'] },
            }),
          ]);
          if (
            first.epoch?.epoch?.toString() !== window.minEpoch ||
            last.epoch?.epoch?.toString() !== window.maxEpoch
          )
            throw Error('EPOCH_HISTORY_MISMATCH');
          evidence.firstValidCheckpoint = first.epoch.firstCheckpoint?.toString();
          evidence.lastValidCheckpoint = last.epoch.lastCheckpoint?.toString();
          if (last.epoch.lastCheckpoint === undefined) throw Error('EPOCH_NOT_CLOSED');
          const { response } = await client.ledgerService.getCheckpoint({
            checkpointId: {
              oneofKind: 'sequenceNumber',
              sequenceNumber: last.epoch.lastCheckpoint,
            },
            readMask: {
              paths: ['digest', 'sequence_number', 'summary.epoch', 'summary.end_of_epoch_data'],
            },
          });
          const cp = response.checkpoint;
          evidence.boundaryDigest = cp?.digest;
          evidence.boundaryEpoch = cp?.summary?.epoch?.toString();
          evidence.boundaryClosed =
            cp?.sequenceNumber === last.epoch.lastCheckpoint && !!cp?.summary?.endOfEpochData;
        }
        // Confirm retention still covers the complete window after the digest read.
        const { response: after } = await client.ledgerService.getServiceInfo({});
        if (
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
        const code = (e as { code?: string }).code;
        evidence.error = [
          'NOT_FOUND',
          'UNAVAILABLE',
          'DEADLINE_EXCEEDED',
          'RESOURCE_EXHAUSTED',
          'UNAUTHENTICATED',
        ].includes(code || '')
          ? code
          : 'READ_UNCERTAIN';
      } finally {
        transport.close();
      }
      evidence.checkedAt = new Date().toISOString();
      return evidence;
    }),
  );
}
