// Run only with the digest returned AFTER a separately authorized conversion.
// Native Tatum reads only: this module cannot sign, broadcast or retry a payment.
import { readFile, writeFile } from 'node:fs/promises';
import { config } from 'dotenv';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { credentials } from '@grpc/grpc-js';
import { AMOUNT, ASSET, GENESIS, assertExactBytes, parseBalance } from './transaction';

config({ path: '.env.local', quiet: true });
const digest = process.argv[2];
if (!digest || !/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(digest))
  throw new Error('Supply only the actual conversion digest after owner-approved execution.');
if (!process.env.TATUM_API_KEY) throw new Error('Server-side Tatum configuration is required.');
const p = JSON.parse(await readFile('.data/sui-self-deposit/preview.json', 'utf8'));
const parties = JSON.parse(await readFile('.data/production-payment-parties.json', 'utf8'));
if (
  p.plan.payer !== parties.payer ||
  p.plan.payer === parties.recipient ||
  digest !== p.unsignedDigest
)
  throw new Error(
    'Digest or Wallet A differs from the reviewed unsigned preview. Do not repeat a transaction.',
  );
const transport = new GrpcTransport({
  host: 'sui-mainnet-grpc.gateway.tatum.io:443',
  channelCredentials: credentials.createSsl(),
  meta: { 'x-api-key': process.env.TATUM_API_KEY },
  timeout: 10000,
});
let stage = 'tatum-mainnet-identity';
try {
  const client = new SuiGrpcClient({ network: 'mainnet', transport });
  const { response: info } = await client.ledgerService.getServiceInfo({});
  if (info.chain !== 'mainnet' || info.chainId !== GENESIS) throw new Error('Wrong chain.');
  await new Promise((r) => setTimeout(r, 600));
  stage = 'finalized-transaction';
  const result = await client.core.getTransaction({
    digest,
    include: { bcs: true, effects: true, balanceChanges: true },
  });
  if (
    result.$kind !== 'Transaction' ||
    !result.Transaction.status.success ||
    result.Transaction.checkpoint == null ||
    result.Transaction.digest !== digest ||
    !result.Transaction.bcs
  )
    throw new Error('Successful finalized transaction not proven. Reconcile; never resubmit.');
  const tx = result.Transaction;
  await assertExactBytes(tx.bcs, p.plan);
  const gas = tx.effects.gasUsed;
  const netGas = BigInt(gas.computationCost) + BigInt(gas.storageCost) - BigInt(gas.storageRebate);
  await new Promise((r) => setTimeout(r, 600));
  stage = 'updated-address-balance';
  const { response: b } = await client.stateService.getBalance({
    owner: p.plan.payer,
    coinType: ASSET,
  });
  const after = parseBalance(b.balance);
  const expected = {
    total: (BigInt(p.before.total) - netGas).toString(),
    coins: (BigInt(p.before.coins) - AMOUNT - netGas).toString(),
    address: (BigInt(p.before.address) + AMOUNT).toString(),
  };
  const balancesMatch = Object.entries(expected).every(
    ([k, v]) => after[k as keyof typeof after] === v,
  );
  const report = {
    checkedAt: new Date().toISOString(),
    source: 'Tatum native Sui Mainnet gRPC',
    genesis: GENESIS,
    digest,
    checkpoint: tx.checkpoint,
    successfulFinalized: true,
    exactApprovedBytes: true,
    conversionMist: AMOUNT.toString(),
    gas,
    netGasMist: netGas.toString(),
    before: p.before,
    after,
    expected,
    balanceDeltaMatches: balancesMatch,
    usableAddressBalance: BigInt(after.address) >= 1000000n,
    status: balancesMatch
      ? 'confirmed-self-deposit'
      : 'finalized-but-current-balance-differs-investigate-other-activity',
    servicePayment: false,
  };
  await writeFile(
    `.data/sui-self-deposit/verified-${digest}.json`,
    JSON.stringify(report, null, 2) + '\n',
    { flag: 'wx', mode: 0o600 },
  );
  console.log(JSON.stringify(report, null, 2));
  if (!balancesMatch) process.exitCode = 2;
} catch {
  console.error(
    JSON.stringify({
      stage,
      status: 'unverified',
      checkedAt: new Date().toISOString(),
      action:
        'Do not repeat the conversion. Reconcile the existing digest and provider response first.',
    }),
  );
  process.exitCode = 1;
} finally {
  transport.close();
}
