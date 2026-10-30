import { readFile, writeFile } from 'node:fs/promises';
import { parse } from 'dotenv';
import { credentials } from '@grpc/grpc-js';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { normalizeStructTag } from '@mysten/sui/utils';
import { AMOUNT, ASSET, GAS_BUDGET, GENESIS, assertExactBytes, parseBalance } from './transaction';
import type { Prepared, Verification } from './workflow';

export async function reconcileConversion(p: Prepared, dir: string): Promise<Verification> {
  let stage = 'tatum-configuration';
  let transport: GrpcTransport | undefined;
  const checkedAt = new Date().toISOString();
  try {
    const key = process.env.TATUM_API_KEY || parse(await readFile('.env.local'))['TATUM_API_KEY'];
    if (!key) throw new Error('Configuration missing');
    transport = new GrpcTransport({
      host: 'sui-mainnet-grpc.gateway.tatum.io:443',
      channelCredentials: credentials.createSsl(),
      meta: { 'x-api-key': key },
      timeout: 10000,
      clientOptions: { 'grpc.enable_retries': 0 },
    });
    const client = new SuiGrpcClient({ network: 'mainnet', transport });
    stage = 'tatum-mainnet-identity';
    const { response: info } = await client.ledgerService.getServiceInfo({});
    if (info.chain !== 'mainnet' || info.chainId !== GENESIS) throw new Error('Wrong network');
    await new Promise((r) => setTimeout(r, 600));
    stage = 'finalized-transaction';
    const result = await client.core.getTransaction({
      digest: p.unsignedDigest,
      include: { bcs: true, effects: true, balanceChanges: true },
    });
    const tx = result.$kind === 'Transaction' ? result.Transaction : result.FailedTransaction;
    if (tx.digest !== p.unsignedDigest || tx.checkpoint == null || !tx.bcs)
      return { status: 'pending', checkedAt, stage, digest: p.unsignedDigest };
    await assertExactBytes(tx.bcs, p.plan);
    const gas = tx.effects.gasUsed;
    const netGas =
      BigInt(gas.computationCost) + BigInt(gas.storageCost) - BigInt(gas.storageRebate);
    if (netGas > GAS_BUDGET) throw new Error('Gas limit mismatch');
    await new Promise((r) => setTimeout(r, 600));
    stage = 'updated-wallet-a-balances';
    const { response: b } = await client.stateService.getBalance({
      owner: p.plan.payer,
      coinType: ASSET,
    });
    const after = parseBalance(b.balance);
    const expected = {
      total: (BigInt(p.before.total) - netGas).toString(),
      coins: (BigInt(p.before.coins) - (tx.status.success ? AMOUNT : 0n) - netGas).toString(),
      address: (BigInt(p.before.address) + (tx.status.success ? AMOUNT : 0n)).toString(),
    };
    const balancesMatch = Object.entries(expected).every(
      ([k, v]) => after[k as keyof typeof after] === v,
    );
    const changes = tx.balanceChanges;
    const changesMatch =
      changes.length === 1 &&
      changes[0].address === p.plan.payer &&
      normalizeStructTag(changes[0].coinType) === normalizeStructTag(ASSET) &&
      BigInt(changes[0].amount) === -netGas;
    const report: Verification = {
      status: !tx.status.success
        ? 'finalized_failed'
        : balancesMatch && changesMatch
          ? 'confirmed'
          : 'balance_mismatch',
      checkedAt,
      source: 'Tatum native Sui Mainnet gRPC',
      genesis: GENESIS,
      digest: p.unsignedDigest,
      checkpoint: tx.checkpoint,
      successfulFinalized: tx.status.success,
      exactApprovedBytes: true,
      conversionMist: tx.status.success ? AMOUNT.toString() : '0',
      gas,
      netGasMist: netGas.toString(),
      before: p.before,
      after,
      expected,
      balanceDeltaMatches: balancesMatch,
      balanceChangesMatch: changesMatch,
      usableAddressBalance: BigInt(after.address) >= 1000000n,
      servicePayment: false,
    };
    const file = `${dir}/verified-${p.unsignedDigest}.json`;
    // Preserve the first observation; subsequent checks are retained in attempt.json.
    try {
      await writeFile(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    return report;
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    return {
      status: stage === 'finalized-transaction' && code === 'NOT_FOUND' ? 'pending' : 'uncertain',
      checkedAt,
      stage,
      digest: p.unsignedDigest,
      message:
        'Tatum has not proven the complete result. Check the same digest again; never resend.',
    };
  } finally {
    transport?.close();
  }
}
