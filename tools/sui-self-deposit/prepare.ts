// READ-ONLY: builds and simulates unsigned bytes; has no execution or signing API.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { normalizeStructTag, toBase64 } from '@mysten/sui/utils';
import type { SuiClientTypes } from '@mysten/sui/client';
import { config } from 'dotenv';
import { serviceChainPreflight } from '../../src/lib/integrations/service-tatum';
import {
  AMOUNT,
  ASSET,
  GAS_BUDGET,
  GENESIS,
  RPC,
  assertExactBytes,
  fullAddress,
  parseBalance,
  selectCoins,
  selfDeposit,
  type Plan,
} from './transaction';

// Credentials are used only by the existing server-side Tatum read integration.
// They are never returned to the local UI or written to the preview.
config({ path: '.env.local', quiet: true });
let stage = 'configuration';
try {
  const parties = JSON.parse(await readFile('.data/production-payment-parties.json', 'utf8'));
  const payer = fullAddress(parties.payer);
  if (payer === parties.recipient) throw new Error('Wallet A must differ from Wallet B.');
  stage = 'tatum-mainnet-baseline';
  const tatum = await serviceChainPreflight('sui:mainnet', { payer });
  const baseline = tatum.balances.payer;
  if (!baseline || !tatum.genesis || tatum.genesis !== GENESIS)
    throw new Error('No verified Tatum Mainnet baseline.');
  stage = 'official-mainnet-identity';
  const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: RPC });
  const { response: info } = await client.ledgerService.getServiceInfo({});
  if (info.chain !== 'mainnet' || info.chainId !== GENESIS)
    throw new Error('Official endpoint is not verified Sui Mainnet.');
  const { response: epochResponse } = await client.ledgerService.getEpoch({
    readMask: { paths: ['epoch', 'reference_gas_price', 'protocol_config.feature_flags'] },
  });
  const epoch = epochResponse.epoch;
  if (
    epoch?.epoch == null ||
    !epoch.referenceGasPrice ||
    !epoch.protocolConfig?.featureFlags['enable_address_balance_gas_payments']
  )
    throw new Error('Current epoch, reference gas price or address-balance feature unavailable.');
  stage = 'coin-object-selection';
  const coins: SuiClientTypes.Coin[] = [];
  let cursor: string | null = null;
  for (let page = 0; ; page++) {
    const response = await client.core.listCoins({
      owner: payer,
      coinType: ASSET,
      cursor,
      limit: 100,
    });
    coins.push(...response.objects);
    if (!response.hasNextPage) break;
    if (!response.cursor || page >= 9) throw new Error('Incomplete owned-coin pagination.');
    cursor = response.cursor;
  }
  const { response: balanceResponse } = await client.stateService.getBalance({
    owner: payer,
    coinType: ASSET,
  });
  stage = 'compare-independent-balances';
  const balance = parseBalance(balanceResponse.balance);
  if (
    balance.total !== baseline.totalAtomic ||
    balance.coins !== baseline.coinAtomic ||
    balance.address !== baseline.addressAtomic ||
    coins.reduce((sum, c) => sum + BigInt(c.balance), 0n).toString() !== balance.coins
  )
    throw new Error('Providers or owned-coin listing disagree. Refresh; do not sign.');
  const selected = selectCoins(coins, payer);
  const plan: Plan = {
    payer,
    gasPrice: epoch.referenceGasPrice.toString(),
    expirationEpoch: Number(epoch.epoch + 1n),
    coins: selected.map(({ objectId, version, digest }) => ({ objectId, version, digest })),
  };
  stage = 'unsigned-build';
  const tx = selfDeposit(plan);
  const bytes = await tx.build({ client });
  await assertExactBytes(bytes, plan);
  stage = 'mainnet-simulation';
  const sim = await client.core.simulateTransaction({
    transaction: bytes,
    checksEnabled: true,
    include: { effects: true, balanceChanges: true },
  });
  if (sim.$kind !== 'Transaction' || !sim.Transaction.status.success || sim.gasPaymentMocked)
    throw new Error('Simulation failed or used a mocked gas balance. No signing allowed.');
  const gas = sim.Transaction.effects.gasUsed;
  const netGas = BigInt(gas.computationCost) + BigInt(gas.storageCost) - BigInt(gas.storageRebate);
  if (netGas > GAS_BUDGET) throw new Error('Simulated gas exceeds the fixed cap.');
  const changes = sim.Transaction.balanceChanges;
  // Self-deposit changes total SUI only by gas; 0.005 changes custody form.
  const ownerChanges = changes.filter((c) => c.address === payer);
  if (
    changes.length !== 1 ||
    ownerChanges.length !== 1 ||
    normalizeStructTag(ownerChanges[0].coinType) !== normalizeStructTag(ASSET) ||
    BigInt(ownerChanges[0].amount) !== -netGas
  )
    throw new Error('Unexpected simulated balance changes. Stop and inspect.');
  const now = new Date();
  const preview = {
    version: 1,
    mode: 'review-only',
    signingEnabled: false,
    executionEnabled: false,
    checkedAt: now.toISOString(),
    reviewExpiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
    network: 'Sui Mainnet',
    chain: 'sui:mainnet',
    genesis: GENESIS,
    asset: ASSET,
    amountMist: AMOUNT.toString(),
    gasBudgetMist: GAS_BUDGET.toString(),
    plan,
    before: balance,
    expected: {
      total: (BigInt(balance.total) - netGas).toString(),
      coins: (BigInt(balance.coins) - AMOUNT - netGas).toString(),
      address: (BigInt(balance.address) + AMOUNT).toString(),
      minimumCoinsAfterGasCap: (BigInt(balance.coins) - AMOUNT - GAS_BUDGET).toString(),
    },
    simulation: {
      success: true,
      checksEnabled: true,
      gasPaymentMocked: false,
      gas,
      estimatedNetGasMist: netGas.toString(),
      balanceChanges: changes,
    },
    providers: {
      tatumCheckpoint: tatum.checkpoint,
      officialCheckpoint: info.checkpointHeight?.toString(),
      addressBalanceEnabled: true,
    },
    unsignedBytes: toBase64(bytes),
    unsignedDigest: await tx.getDigest(),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    decoded: tx.getData(),
  };
  await mkdir('.data/sui-self-deposit', { recursive: true });
  await writeFile('.data/sui-self-deposit/preview.json', JSON.stringify(preview, null, 2) + '\n', {
    mode: 0o600,
  });
  console.log(
    JSON.stringify(
      {
        stage: 'ready-for-owner-review',
        ...preview,
        unsignedBytes: '[local preview file]',
        decoded: '[local preview file]',
      },
      null,
      2,
    ),
  );
} catch (error) {
  // Provider error strings can contain metadata. Emit a fixed stage and safe label.
  console.error(
    JSON.stringify({
      stage,
      checkedAt: new Date().toISOString(),
      status: 'failed',
      signed: false,
      submitted: false,
      code: error instanceof Error ? error.name : 'UnknownError',
      reason:
        error instanceof Error &&
        /^(Providers or owned|Unverified, duplicate|Insufficient usable|Incomplete owned|Simulation failed|Unexpected simulated|Simulated gas|Missing explicit|Missing balance|Inconsistent balance)/.test(
          error.message,
        )
          ? error.message
          : 'Provider or configuration check failed; no credentials logged.',
      action: 'No transaction sent. Inspect this stage locally, then retry the read-only preview.',
    }),
  );
  process.exitCode = 1;
}
