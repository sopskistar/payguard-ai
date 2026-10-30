import { Transaction } from '@mysten/sui/transactions';
import { normalizeSuiAddress, normalizeStructTag, toBase64 } from '@mysten/sui/utils';
import type { SuiClientTypes } from '@mysten/sui/client';

// This standalone tool never imports the PayGuard application or payment flow.
export const AMOUNT = 5_000_000n;
export const GAS_BUDGET = 2_000_000n;
export const GENESIS = '4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S';
export const ASSET = '0x2::sui::SUI';
export const CHAIN = 'sui:mainnet';
export const RPC = 'https://fullnode.mainnet.sui.io:443';

export function fullAddress(value: string) {
  if (!/^0x[a-f0-9]{64}$/.test(value) || /^0x0+$/.test(value))
    throw new Error('A complete, nonzero Wallet A public address is required.');
  return value;
}

export type Plan = {
  payer: string;
  gasPrice: string;
  expirationEpoch: number;
  coins: { objectId: string; version: string; digest: string }[];
};

export function selectCoins(coins: SuiClientTypes.Coin[], payer: string) {
  fullAddress(payer);
  const ids = new Set<string>();
  for (const coin of coins) {
    if (
      coin.owner.$kind !== 'AddressOwner' ||
      normalizeSuiAddress(coin.owner.AddressOwner) !== payer ||
      normalizeStructTag(coin.type) !== normalizeStructTag('0x2::coin::Coin<0x2::sui::SUI>') ||
      !/^\d+$/.test(coin.balance) ||
      ids.has(coin.objectId)
    )
      throw new Error('Unverified, duplicate or non-SUI owned coin.');
    ids.add(coin.objectId);
  }
  const sorted = [...coins].sort((a, b) =>
    BigInt(a.balance) === BigInt(b.balance)
      ? a.objectId.localeCompare(b.objectId)
      : BigInt(a.balance) > BigInt(b.balance)
        ? -1
        : 1,
  );
  const selected: SuiClientTypes.Coin[] = [];
  let sum = 0n;
  for (const coin of sorted) {
    if (sum >= AMOUNT + GAS_BUDGET) break;
    selected.push(coin);
    sum += BigInt(coin.balance);
  }
  if (sum < AMOUNT + GAS_BUDGET || selected.length > 16)
    throw new Error('Insufficient usable coins for exactly 0.005 SUI plus the gas cap.');
  return selected;
}

export function selfDeposit(plan: Plan) {
  fullAddress(plan.payer);
  if (
    !/^[1-9]\d*$/.test(plan.gasPrice) ||
    !Number.isSafeInteger(plan.expirationEpoch) ||
    plan.expirationEpoch < 1 ||
    !plan.coins.length ||
    plan.coins.length > 16
  )
    throw new Error('Invalid gas or expiration plan.');
  const tx = new Transaction();
  tx.setSender(plan.payer);
  tx.setGasOwner(plan.payer);
  tx.setGasPrice(plan.gasPrice);
  tx.setGasBudget(GAS_BUDGET);
  tx.setGasPayment(plan.coins);
  tx.setExpiration({ Epoch: plan.expirationEpoch });
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(AMOUNT)]);
  tx.moveCall({
    target: '0x2::coin::send_funds',
    typeArguments: [ASSET],
    arguments: [coin, tx.pure.address(plan.payer)],
  });
  return tx;
}

// Reconstruct and compare the entire canonical BCS. This rejects extra commands,
// recipient/amount changes, gas sponsorship, withdrawals and altered gas limits.
export async function assertExactBytes(bytes: Uint8Array, plan: Plan) {
  const expected = await selfDeposit(plan).build();
  if (toBase64(bytes) !== toBase64(expected))
    throw new Error('Transaction differs from the fixed Wallet A self-deposit plan.');
}

export function parseBalance(
  b:
    | {
        balance?: bigint;
        coinBalance?: bigint;
        addressBalance?: bigint;
        coinType?: string;
      }
    | undefined,
) {
  if (
    !b ||
    b.balance == null ||
    !b.coinType ||
    normalizeStructTag(b.coinType) !== normalizeStructTag(ASSET)
  )
    throw new Error('Missing explicit native SUI total balance.');
  const total = b.balance;
  let coins = b.coinBalance,
    address = b.addressBalance;
  if (coins == null && address == null) {
    if (total !== 0n) throw new Error('Missing balance components.');
    coins = address = 0n;
  } else if (coins == null) coins = total - address!;
  else if (address == null) address = total - coins;
  if (total < 0n || coins < 0n || address! < 0n || coins + address! !== total)
    throw new Error('Inconsistent balance components.');
  return { total: total.toString(), coins: coins.toString(), address: address!.toString() };
}

export function formatSui(mist: string | bigint) {
  const n = BigInt(mist);
  const sign = n < 0n ? '-' : '';
  const abs = n < 0n ? -n : n;
  return sign + abs / 1_000_000_000n + '.' + (abs % 1_000_000_000n).toString().padStart(9, '0');
}
