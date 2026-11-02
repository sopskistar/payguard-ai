import type { SuiClientTypes } from '@mysten/sui/client';
import { normalizeStructTag, normalizeSuiAddress } from '@mysten/sui/utils';
import { MAX_SERVICE_COINS, SERVICE_ASSET, type ServiceCoinFunding } from './service-protocol';

export function selectServiceCoins(
  coins: SuiClientTypes.Coin[],
  payer: string,
  amount: string,
  addressBalance: string,
): ServiceCoinFunding {
  const eligible = coins
    .filter(
      (c) =>
        c.owner.$kind === 'AddressOwner' &&
        normalizeSuiAddress(c.owner.AddressOwner) === normalizeSuiAddress(payer) &&
        normalizeStructTag(c.type) === normalizeStructTag(`0x2::coin::Coin<${SERVICE_ASSET}>`) &&
        BigInt(c.balance) > 0n,
    )
    .sort((a, b) => (BigInt(a.balance) > BigInt(b.balance) ? -1 : 1));
  const selected: SuiClientTypes.Coin[] = [];
  let sum = 0n;
  for (const coin of eligible) {
    if (selected.length === MAX_SERVICE_COINS) break;
    selected.push(coin);
    sum += BigInt(coin.balance);
    if (sum >= BigInt(amount)) break;
  }
  const deficit = sum < BigInt(amount) ? BigInt(amount) - sum : 0n;
  if (!selected.length || deficit > BigInt(addressBalance))
    throw new Error(
      'Insufficient usable SUI in the first 16 selected coins and address balance. No signature or conversion was requested. Refresh balances before retrying.',
    );
  return {
    coins: selected.map(({ objectId, version, digest }) => ({ objectId, version, digest })),
    addressWithdrawal: deficit.toString(),
  };
}

// Server checks current chain ownership, immutable references and the minimum
// withdrawal required by the selected coins. Never trust browser balance claims.
export function checkServiceCoinObjects(
  funding: ServiceCoinFunding,
  coins: SuiClientTypes.Coin[],
  payer: string,
  amount: string,
  addressBalance: string,
) {
  let sum = 0n;
  if (coins.length !== funding.coins.length) throw new Error('Coin input missing');
  for (const ref of funding.coins) {
    const c = coins.find((c) => c.objectId === ref.objectId);
    if (
      !c ||
      c.version !== ref.version ||
      c.digest !== ref.digest ||
      c.owner.$kind !== 'AddressOwner' ||
      c.owner.AddressOwner !== normalizeSuiAddress(payer) ||
      normalizeStructTag(c.type) !== normalizeStructTag(`0x2::coin::Coin<${SERVICE_ASSET}>`) ||
      BigInt(c.balance) <= 0n
    )
      throw new Error('Coin ownership, type or version changed');
    sum += BigInt(c.balance);
  }
  const deficit = sum < BigInt(amount) ? BigInt(amount) - sum : 0n;
  if (deficit > BigInt(addressBalance) || deficit !== BigInt(funding.addressWithdrawal))
    throw new Error('Coin funding no longer matches the exact purchase');
}
