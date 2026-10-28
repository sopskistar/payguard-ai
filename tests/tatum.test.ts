import { describe, it, expect, vi, afterEach } from 'vitest';
import { toBase58 } from '@mysten/sui/utils';
import {
  reconcile,
  normalizeGrpcTransaction,
  mainnetIdentifier,
  MAINNET_CHAIN_ID,
  chainHealth,
  grpcFailure,
  type ChainTransaction,
} from '@/lib/integrations/tatum';
import { demoInvoices } from '@/lib/demo';
import { units, digestSchema } from '@/lib/validation';
const digest = toBase58(new Uint8Array(32).fill(3));
const sender = '0x' + '3'.repeat(64),
  invoice = demoInvoices()[0];
const tx: ChainTransaction = {
  digest,
  effects: { status: { status: 'success' } },
  transaction: { data: { sender, gasData: { owner: sender } } },
  balanceChanges: [
    {
      owner: { AddressOwner: invoice.recipient },
      coinType: '0x2::sui::SUI',
      amount: '500000000000',
    },
  ],
  checkpoint: '12345',
};
afterEach(() => vi.unstubAllEnvs());
describe('Tatum reconciliation, using synthetic chain fixtures only', () => {
  it('matches exact positive credits with BigInt precision', () =>
    expect(reconcile(invoice, tx, 9, MAINNET_CHAIN_ID).status).toBe('Confirmed match'));
  it.each(['failure', 'missing'])('fails closed on %s effects', (kind) =>
    expect(
      reconcile(
        invoice,
        { ...tx, effects: kind === 'missing' ? undefined : { status: { status: 'failure' } } },
        9,
        MAINNET_CHAIN_ID,
      ).status,
    ).not.toBe('Confirmed match'),
  );
  it('rejects wrong network, recipient, coin and double match', () => {
    expect(reconcile(invoice, tx, 9, 'testnet').status).toBe('Mismatch');
    expect(reconcile({ ...invoice, recipient: sender }, tx, 9, MAINNET_CHAIN_ID).status).toBe(
      'Mismatch',
    );
    expect(reconcile({ ...invoice, coinType: '0x3::x::X' }, tx, 9, MAINNET_CHAIN_ID).status).toBe(
      'Mismatch',
    );
    expect(reconcile(invoice, tx, 9, MAINNET_CHAIN_ID, true).status).toBe('Conflict');
  });
  it('requires a finalized checkpoint', () =>
    expect(reconcile(invoice, { ...tx, checkpoint: undefined }, 9, MAINNET_CHAIN_ID).status).toBe(
      'Needs review',
    ));
  it('requires explicit agreed tokens for a fiat invoice', () =>
    expect(reconcile({ ...invoice, tokenAmount: '' }, tx, 9, MAINNET_CHAIN_ID).status).toBe(
      'Needs review',
    ));
  it('rejects overpayment, underpayment and gas-owner rebate', () => {
    for (const amount of ['499999999999', '500000000001', '-500000000000'])
      expect(
        reconcile(
          invoice,
          { ...tx, balanceChanges: [{ ...tx.balanceChanges![0], amount }] },
          9,
          MAINNET_CHAIN_ID,
        ).status,
      ).toBe('Mismatch');
    expect(
      reconcile(
        invoice,
        { ...tx, transaction: { data: { sender, gasData: { owner: invoice.recipient } } } },
        9,
        MAINNET_CHAIN_ID,
      ).status,
    ).toBe('Mismatch');
  });
  it('does not turn missing decimals or sender into confirmation', () => {
    expect(reconcile(invoice, tx, null, MAINNET_CHAIN_ID).status).toBe('Needs review');
    expect(reconcile(invoice, { ...tx, transaction: undefined }, 9, MAINNET_CHAIN_ID).status).toBe(
      'Needs review',
    );
  });
  it('preserves uint64 checkpoint and signed amounts when normalizing protobuf', () => {
    const normalized = normalizeGrpcTransaction({
      digest,
      signatures: [],
      transaction: { sender, gasPayment: { objects: [], owner: sender } },
      effects: {
        status: { success: true },
        changedObjects: [],
        unchangedConsensusObjects: [],
        dependencies: [],
        unchangedLoadedRuntimeObjects: [],
      },
      balanceChanges: [
        { address: invoice.recipient, coinType: '0x2::sui::SUI', amount: '500000000000' },
      ],
      checkpoint: 9007199254740993n,
      timestamp: { seconds: 1793000000n, nanos: 123000000 },
    });
    expect(normalized.checkpoint).toBe('9007199254740993');
    expect(normalized.timestampMs).toBe('1793000000123');
    expect(normalized.effects?.status.status).toBe('success');
  });
  it('does not infer success from protobuf default omissions', () => {
    const normalized = normalizeGrpcTransaction({ digest, signatures: [], balanceChanges: [] });
    expect(normalized.effects).toBeUndefined();
  });
  it('derives the short chain identifier from the genesis digest and verifies the chain name', () => {
    const bytes = new Uint8Array(32);
    bytes.set([0x35, 0x83, 0x4a, 0x8a]);
    expect(mainnetIdentifier(toBase58(bytes), 'mainnet')).toBe(MAINNET_CHAIN_ID);
    expect(() => mainnetIdentifier(toBase58(bytes), 'testnet')).toThrow();
  });
  it('does not call providers without configured credentials', async () => {
    vi.stubEnv('TATUM_API_KEY', '');
    await expect(chainHealth()).rejects.toThrow('not configured');
  });
  it('redacts provider messages that could contain request metadata', () => {
    expect(grpcFailure({ code: 'UNAUTHENTICATED', message: 'secret-key' }).message).not.toContain(
      'secret-key',
    );
  });
  it('validates digest bytes and exact decimal conversion', () => {
    expect(digestSchema.safeParse('z'.repeat(44)).success).toBe(false);
    expect(units('9007199254740993.123456789', 9)).toBe(9007199254740993123456789n);
    expect(() => units('1.0000000001', 9)).toThrow();
  });
});
