import { describe, expect, it } from 'vitest';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import type { SuiClientTypes } from '@mysten/sui/client';
import {
  AMOUNT,
  GAS_BUDGET,
  assertExactBytes,
  parseBalance,
  selectCoins,
  selfDeposit,
} from '../tools/sui-self-deposit/transaction';

const payer = normalizeSuiAddress('0xa');
const other = normalizeSuiAddress('0xb');
const coin: SuiClientTypes.Coin = {
  objectId: normalizeSuiAddress('0xc'),
  version: '1',
  digest: '11111111111111111111111111111111',
  type: '0x2::coin::Coin<0x2::sui::SUI>',
  balance: '27993344',
  owner: { $kind: 'AddressOwner', AddressOwner: payer },
};
const plan = {
  payer,
  gasPrice: '100',
  expirationEpoch: 1297,
  coins: [{ objectId: coin.objectId, version: coin.version, digest: coin.digest }],
};

describe('fixed 0.005 SUI self-deposit unsigned preparation', () => {
  it('builds exactly a gas-coin split and self send_funds, with coin gas remaining', async () => {
    const tx = selfDeposit(plan);
    const bytes = await tx.build();
    await expect(assertExactBytes(bytes, plan)).resolves.toBeUndefined();
    const d = tx.getData();
    expect(d.commands).toHaveLength(2);
    expect(d.commands[0].$kind).toBe('SplitCoins');
    expect(d.commands[1].MoveCall?.function).toBe('send_funds');
    expect(d.gasData.owner).toBe(payer);
    expect(d.gasData.payment).toHaveLength(1);
    expect(BigInt(coin.balance) - AMOUNT - GAS_BUDGET).toBe(20993344n);
  });
  for (const field of [
    'sender',
    'destination',
    'amount',
    'gas-owner',
    'gas-budget',
    'gas-price',
    'extra-command',
    'asset',
  ] as const)
    it(`rejects changed ${field} in transaction bytes`, async () => {
      const tx = selfDeposit(plan);
      if (field === 'sender') tx.setSender(other);
      if (field === 'gas-owner') tx.setGasOwner(other);
      if (field === 'gas-budget') tx.setGasBudget(3000000);
      if (field === 'gas-price') tx.setGasPrice(101);
      if (field === 'extra-command') tx.transferObjects([tx.gas], other);
      const d = tx.getData();
      if (field === 'destination')
        d.inputs[1].Pure!.bytes = Buffer.from(other.slice(2), 'hex').toString('base64');
      if (field === 'amount')
        d.inputs[0].Pure!.bytes = Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]).toString('base64');
      if (field === 'asset') d.commands[1].MoveCall!.typeArguments = ['0x2::foo::FOO'];
      const { Transaction } = await import('@mysten/sui/transactions');
      const bytes = await Transaction.from(JSON.stringify(d)).build();
      await expect(assertExactBytes(bytes, plan)).rejects.toThrow('differs');
    });
  it('accepts real owned SUI only and rejects duplicate objects and insufficient coin funds', () => {
    expect(selectCoins([coin], payer)).toEqual([coin]);
    expect(() => selectCoins([coin, coin], payer)).toThrow('duplicate');
    expect(() =>
      selectCoins([{ ...coin, owner: { $kind: 'AddressOwner', AddressOwner: other } }], payer),
    ).toThrow('Unverified');
    expect(() =>
      selectCoins([{ ...coin, type: '0x2::coin::Coin<0x2::other::OTHER>' }], payer),
    ).toThrow('Unverified');
    expect(() => selectCoins([{ ...coin, balance: '5000000' }], payer)).toThrow('Insufficient');
  });
  it('never treats missing balances as zero and derives only provable omitted fields', () => {
    expect(() => parseBalance(undefined)).toThrow('Missing');
    expect(() => parseBalance({ coinType: '0x2::sui::SUI' })).toThrow('Missing');
    expect(parseBalance({ coinType: '0x2::sui::SUI', balance: 0n })).toEqual({
      total: '0',
      coins: '0',
      address: '0',
    });
    expect(
      parseBalance({ coinType: '0x2::sui::SUI', balance: 27993344n, coinBalance: 27993344n }),
    ).toEqual({ total: '27993344', coins: '27993344', address: '0' });
    expect(() => parseBalance({ coinType: '0x2::sui::SUI', balance: 1n })).toThrow('Missing');
  });
});
