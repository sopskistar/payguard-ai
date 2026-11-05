import { it, expect } from 'vitest';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { verifyTransactionSignature } from '@mysten/sui/verify';
import {
  buildServiceTransaction,
  MAINNET_GENESIS,
  serviceTermsSchema,
} from '@/lib/service-protocol';
import {
  ACCEPTANCE_PAYER,
  ACCEPTANCE_MERCHANT,
  ACCEPTANCE_ORIGIN,
  OLD_ACCEPTANCE_QUOTE,
  requireExactCustomer,
  validateTerminalQuote,
  validateTerminalPreparation,
  requireTerminalApproval,
} from '../tools/service-acceptance/contract';
const sponsor = '0x' + '3'.repeat(64),
  id = 'a0000000-0000-4000-8000-000000000001';
const terms = serviceTermsSchema.parse({
  scheme: 'exact',
  network: 'sui:mainnet',
  asset: '0x2::sui::SUI',
  amount: '1000000',
  payTo: ACCEPTANCE_MERCHANT,
  maxTimeoutSeconds: 300,
  extra: {
    quoteId: id,
    gasOwner: sponsor,
    gasBudget: '2000000',
    instructionHash: 'a'.repeat(64),
    authenticatedPayer: ACCEPTANCE_PAYER,
  },
});
function quote() {
  return {
    id,
    expiresAt: new Date(Date.now() + 300000).toISOString(),
    x402Version: 2,
    resource: {
      url: ACCEPTANCE_ORIGIN + '/api/service-payments/' + id,
      description: 'Synthetic local contract only',
      mimeType: 'application/json',
    },
    accepts: [structuredClone(terms)],
  };
}
it('requires the exact authorized customer address and exact typed confirmations', () => {
  expect(() => requireExactCustomer(ACCEPTANCE_PAYER)).not.toThrow();
  expect(() => requireExactCustomer(sponsor)).toThrow('TEST_KEY_ADDRESS_MISMATCH');
  expect(() => requireTerminalApproval('yes', 'BEGIN ONE PURCHASE')).toThrow(
    'OWNER_DID_NOT_APPROVE',
  );
  expect(() => requireTerminalApproval('BEGIN ONE PURCHASE', 'BEGIN ONE PURCHASE')).not.toThrow();
  expect(() => requireTerminalApproval('SIGN wrong', 'SIGN exact-digest')).toThrow(
    'OWNER_DID_NOT_APPROVE',
  );
});
it('rejects expired, old, foreign payer, merchant or sponsor quote terms', () => {
  expect(validateTerminalQuote(quote(), sponsor).terms.amount).toBe('1000000');
  for (const change of [
    (q: ReturnType<typeof quote>) => {
      q.expiresAt = new Date(Date.now() - 1).toISOString();
    },
    (q: ReturnType<typeof quote>) => {
      q.id = OLD_ACCEPTANCE_QUOTE;
      q.accepts[0].extra.quoteId = OLD_ACCEPTANCE_QUOTE;
      q.resource.url = ACCEPTANCE_ORIGIN + '/api/service-payments/' + OLD_ACCEPTANCE_QUOTE;
    },
    (q: ReturnType<typeof quote>) => {
      q.accepts[0].payTo = ACCEPTANCE_PAYER;
    },
    (q: ReturnType<typeof quote>) => {
      q.accepts[0].extra.authenticatedPayer = sponsor;
    },
  ]) {
    const q = quote();
    change(q);
    expect(() => validateTerminalQuote(q, sponsor)).toThrow();
  }
  expect(() => validateTerminalQuote(quote(), ACCEPTANCE_PAYER)).toThrow();
});
it('binds the exact frozen digest and epoch window without signing or network execution', async () => {
  const tx = buildServiceTransaction(terms, ACCEPTANCE_PAYER, {
    genesis: MAINNET_GENESIS,
    epoch: '1302',
    gasPrice: '1000',
    nonce: 1,
  });
  const bytes = Buffer.from(await tx.build()).toString('base64'),
    digest = await tx.getDigest();
  expect(
    (await validateTerminalPreparation(bytes, digest, terms, '1302')).maximumPayerGasMist,
  ).toBe('0');
  await expect(validateTerminalPreparation(bytes, 'wrong', terms, '1302')).rejects.toThrow();
  await expect(validateTerminalPreparation(bytes, digest, terms, '1304')).rejects.toThrow();
  await expect(validateTerminalPreparation(bytes, digest, terms, '1301')).rejects.toThrow();
});
it('the installed SDK signs ValidDuring transaction bytes using only a fixed synthetic fixture, never the owner key', async () => {
  const fixture = Ed25519Keypair.fromSecretKey(new Uint8Array(32).fill(7));
  const t = { ...terms, extra: { ...terms.extra, authenticatedPayer: fixture.toSuiAddress() } };
  const tx = buildServiceTransaction(t, fixture.toSuiAddress(), {
    genesis: MAINNET_GENESIS,
    epoch: '1302',
    gasPrice: '1000',
    nonce: 2,
  });
  const bytes = await tx.build();
  const signed = await fixture.signTransaction(bytes);
  expect(Buffer.from(bytes).toString('base64')).toBe(signed.bytes);
  expect((await verifyTransactionSignature(bytes, signed.signature)).toSuiAddress()).toBe(
    fixture.toSuiAddress(),
  );
});
