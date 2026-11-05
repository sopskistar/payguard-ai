// Read-only provider diagnosis. No database, wallet, execution or storage clients.
import { config } from 'dotenv';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { credentials } from '@grpc/grpc-js';
config({ path: '.env.local', quiet: true });
const results: unknown[] = [];
const original = process.argv.includes('--original-pattern');
const archive = process.argv.includes('--archive');
const safe = (v: unknown) => {
  let value = String(v ?? '');
  for (const [name, secret] of Object.entries(process.env)) {
    if (/KEY|SECRET|TOKEN|PASSWORD|DATABASE_URL/i.test(name) && secret && secret.length > 5)
      value = value.replaceAll(secret, '[REDACTED]');
  }
  return value
    .replace(/(x-api-key|authorization|api[_-]?key)([=: ]+)[^\s,;]+/gi, '$1$2[REDACTED]')
    .slice(0, 700);
};
const json = (v: unknown) =>
  JSON.stringify(v, (_, item) => (typeof item === 'bigint' ? item.toString() : item));
const epochMask = ['epoch', 'first_checkpoint', 'last_checkpoint'];
const cpMask = ['digest', 'sequence_number', 'summary.epoch', 'summary.end_of_epoch_data'];
let first: bigint | undefined, last: bigint | undefined;
for (const [provider, host] of [
  ['sui-fullnode', 'fullnode.mainnet.sui.io:443'],
  ['tatum', 'sui-mainnet-grpc.gateway.tatum.io:443'],
  ...(archive ? ([['sui-archive', 'archive.mainnet.sui.io:443']] as const) : []),
] as const) {
  if (archive && provider === 'tatum') continue;
  const transport = new GrpcTransport({
    host,
    channelCredentials: credentials.createSsl(),
    meta: provider === 'tatum' ? { 'x-api-key': process.env.TATUM_API_KEY || '' } : {},
    timeout: 10000,
  });
  const client = new SuiGrpcClient({ network: 'mainnet', transport });
  async function probe<T>(
    method: string,
    request: object,
    operation: () => PromiseLike<T>,
  ): Promise<T | null> {
    if (!original) await new Promise((resolve) => setTimeout(resolve, 750));
    const start = Date.now();
    try {
      const response = await operation();
      const result = {
        provider,
        host,
        method: `sui.rpc.v2.LedgerService/${method}`,
        request,
        status: 'OK',
        durationMs: Date.now() - start,
        response,
      };
      results.push(result);
      console.log(json({ ...result, response: undefined }));
      return response;
    } catch (error) {
      const e = error as { code?: string; message?: string; meta?: Record<string, unknown> };
      const metadata = Object.fromEntries(
        Object.entries(e.meta || {}).filter(([key]) =>
          /^(x-sui-(chain|chain-id|epoch|checkpoint-height|lowest-available-checkpoint)|retry-after|content-type|server)$/.test(
            key,
          ),
        ),
      );
      const result = {
        provider,
        host,
        method: `sui.rpc.v2.LedgerService/${method}`,
        request,
        status: safe(e.code),
        durationMs: Date.now() - start,
        detail: safe(e.message),
        metadata,
        detailSha256: createHash('sha256').update(safe(e.message)).digest('hex'),
      };
      results.push(result);
      console.log(json(result));
      return null;
    }
  }
  try {
    if (original) {
      if (provider !== 'tatum') continue;
      await probe(
        'GetServiceInfo',
        {},
        async () => (await client.ledgerService.getServiceInfo({})).response,
      );
      await probe(
        'GetEpoch',
        {
          readMask: {
            paths: ['epoch', 'protocol_config.protocol_version', 'protocol_config.feature_flags'],
          },
        },
        async () =>
          (
            await client.ledgerService.getEpoch({
              readMask: {
                paths: [
                  'epoch',
                  'protocol_config.protocol_version',
                  'protocol_config.feature_flags',
                ],
              },
            })
          ).response,
      );
      await probe(
        'GetTransaction',
        {
          digest: 'EDe8JMezpxR4qpWFiMQni6ETMdYfYXiM8Sdxnkzvse3s',
          readMask: { paths: ['digest', 'checkpoint', 'effects.status'] },
        },
        async () =>
          (
            await client.ledgerService.getTransaction({
              digest: 'EDe8JMezpxR4qpWFiMQni6ETMdYfYXiM8Sdxnkzvse3s',
              readMask: { paths: ['digest', 'checkpoint', 'effects.status'] },
            })
          ).response,
      );
      await Promise.all(
        [1300n, 1301n].map((epoch) => {
          const paths = ['epoch', epoch === 1300n ? 'first_checkpoint' : 'last_checkpoint'];
          return probe(
            'GetEpoch',
            { epoch, readMask: { paths } },
            async () =>
              (await client.ledgerService.getEpoch({ epoch, readMask: { paths } })).response,
          );
        }),
      );
      continue;
    }
    const info = await probe(
      'GetServiceInfo',
      {},
      async () => (await client.ledgerService.getServiceInfo({})).response,
    );
    await probe(
      'GetEpoch',
      {
        readMask: {
          paths: ['epoch', 'protocol_config.protocol_version', 'protocol_config.feature_flags'],
        },
      },
      async () => {
        const r = (
          await client.ledgerService.getEpoch({
            readMask: {
              paths: ['epoch', 'protocol_config.protocol_version', 'protocol_config.feature_flags'],
            },
          })
        ).response;
        return {
          epoch: r.epoch?.epoch,
          protocolVersion: r.epoch?.protocolConfig?.protocolVersion,
          expiration:
            r.epoch?.protocolConfig?.featureFlags.enable_multi_epoch_transaction_expiration,
          addressGas: r.epoch?.protocolConfig?.featureFlags.enable_address_balance_gas_payments,
        };
      },
    );
    if (info?.epoch != null) {
      const currentEpoch = info.epoch;
      await probe(
        'GetEpoch',
        { epoch: info.epoch, readMask: { paths: epochMask } },
        async () =>
          (
            await client.ledgerService.getEpoch({
              epoch: currentEpoch,
              readMask: { paths: epochMask },
            })
          ).response,
      );
    }
    for (const epoch of [1300n, 1301n]) {
      const r = await probe(
        'GetEpoch',
        { epoch, readMask: { paths: epochMask } },
        async () =>
          (await client.ledgerService.getEpoch({ epoch, readMask: { paths: epochMask } })).response,
      );
      if (provider === 'sui-fullnode') {
        if (epoch === 1300n) first = r?.epoch?.firstCheckpoint;
        else last = r?.epoch?.lastCheckpoint;
      }
    }
    // Default response mask distinguishes masking/parsing from endpoint failures.
    await probe(
      'GetEpoch',
      { epoch: 1301n },
      async () => (await client.ledgerService.getEpoch({ epoch: 1301n })).response,
    );
    const ids = [
      ...new Set(
        [first, last, info?.checkpointHeight, info?.lowestAvailableCheckpoint].filter(
          (v): v is bigint => v != null,
        ),
      ),
    ];
    for (const id of ids)
      await probe(
        'GetCheckpoint',
        { sequenceNumber: id, readMask: { paths: cpMask } },
        async () =>
          (
            await client.ledgerService.getCheckpoint({
              checkpointId: { oneofKind: 'sequenceNumber', sequenceNumber: BigInt(id) },
              readMask: { paths: cpMask },
            })
          ).response,
      );
    if (provider === 'tatum')
      await probe(
        'GetEpoch',
        { epoch: 1301n, readMask: { paths: ['epoch', 'last_checkpoint'] } },
        async () =>
          (
            await client.ledgerService.getEpoch({
              epoch: 1301n,
              readMask: { paths: ['epoch', 'last_checkpoint'] },
            })
          ).response,
      );
  } finally {
    transport.close();
  }
}
await writeFile(
  `docs/evidence/tatum-history-${original ? 'original-pattern' : archive ? 'archive' : 'diagnostic'}-2026-11-05.json`,
  json({ checkedAt: new Date().toISOString(), readOnly: true, results }) + '\n',
);
