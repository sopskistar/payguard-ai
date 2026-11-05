// Owner-operated local terminal only. No key export, server signer, automatic approval or retry.
import { config } from 'dotenv';
import { canonicalCoin } from '../../src/lib/validation';
import { mkdir, writeFile, appendFile, open } from 'node:fs/promises';
import { createHash, randomUUID, randomInt } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import { verifyTransactionSignature } from '@mysten/sui/verify';
import {
  MAINNET_GENESIS,
  SERVICE_ASSET,
  buildServiceTransaction,
  type ServiceChallenge,
} from '../../src/lib/service-protocol';
import { selectServiceCoins } from '../../src/lib/service-funding';
import { normalizeGrpcTransaction } from '../../src/lib/integrations/tatum';
import {
  validateServiceSettlement,
  inspectServiceSettlement,
} from '../../src/lib/integrations/service-tatum';
import {
  ACCEPTANCE_PAYER,
  ACCEPTANCE_MERCHANT,
  ACCEPTANCE_INVOICE,
  OLD_ACCEPTANCE_QUOTE,
  validateTerminalQuote,
  validateTerminalPreparation,
  requireTerminalApproval,
} from './contract';
import { api, localTestSigner, authenticateTestCustomer } from './client';
import type { ControlledRecoveryStatus } from '../../src/lib/approved-service-recoveries';
config({ path: '.env.local', quiet: true });
process.umask(0o077);
type Intent = {
  id: string;
  invoiceId: string;
  state: string;
  payer: string | null;
  digest: string | null;
  prepared: { bytes: string; digest: string } | null;
};
type Metadata = {
  audience: string;
  dedicatedPayer: string;
  configured: boolean;
  network: string;
  preparationAllowed: boolean;
  signingAllowed: boolean;
  exposure: { reservedAtomic: string; capAtomic: string };
  publicPilot: { reservedAtomic: string; capAtomic: string };
  intents: Intent[];
  recoveryHolds: unknown[];
};
type Receipt = {
  id: string;
  intentId: string;
  digest: string;
  network: string;
  result: unknown;
  evidence: unknown;
};
async function main() {
  const execute = process.argv.includes('--execute'),
    reconcileOnly = process.argv.includes('--reconcile-expired');
  if (execute && (!process.stdin.isTTY || !process.stdout.isTTY))
    throw Error('OWNER_INTERACTIVE_TERMINAL_REQUIRED');
  const expectedSha = process.argv[process.argv.indexOf('--expected-sha') + 1];
  if (!process.argv.includes('--expected-sha') || !/^[a-f0-9]{40}$/.test(expectedSha))
    throw Error('EXPECTED_RELEASE_REQUIRED');
  const signer = await localTestSigner(),
    context = await authenticateTestCustomer(signer);
  let terminal: ReturnType<typeof createInterface> | undefined,
    journal: Record<string, unknown> | undefined;
  const journalFile = '.data/terminal-acceptance-operation.json';
  const operationKey = randomUUID();
  await mkdir('.data', { recursive: true });
  async function record(stage: string, detail: Record<string, unknown> = {}) {
    if (!journal) return;
    journal = { ...journal, ...detail, stage, updatedAt: new Date().toISOString() };
    await writeFile(journalFile, JSON.stringify(journal, null, 2) + '\n', { mode: 0o600 });
    await appendFile(
      '.data/terminal-acceptance-events-' + operationKey + '.ndjson',
      JSON.stringify({ stage, ...detail, at: journal.updatedAt }) + '\n',
      { mode: 0o600 },
    );
  }
  try {
    const release = await api<{ commit: string }>(context, '/api/release');
    if (release.commit !== expectedSha) throw Error('PRODUCTION_COMMIT_CHANGED');
    const recoveries = await api<ControlledRecoveryStatus>(
      context,
      '/api/service-payments/recovery',
    );
    if (
      recoveries.enabled ||
      !recoveries.verified ||
      recoveries.scope !== 'member:' + ACCEPTANCE_PAYER ||
      recoveries.nextId ||
      recoveries.records.length !== 3 ||
      recoveries.records.some((r) => !r.recoveredVerified || r.state !== 'expired-unexecuted')
    )
      throw Error('RECOVERY_OR_ACCOUNTING_UNSAFE');
    let metadata = await api<Metadata>(context, '/api/service-payments');
    if (metadata.audience !== 'customer' || metadata.dedicatedPayer !== ACCEPTANCE_PAYER)
      throw Error('AUTHENTICATED_CUSTOMER_CONFLICT');
    const old = metadata.intents.find((i) => i.id === OLD_ACCEPTANCE_QUOTE);
    if (!old) throw Error('ORIGINAL_QUOTE_MISSING');
    if (old.state !== 'cancelled') {
      const outcome = await api<{
        state: string;
        progress: {
          canCancel: boolean;
          prepared: unknown;
          submitted: boolean;
          walletAttempted: boolean;
          executionDigest: string | null;
        };
      }>(context, '/api/service-payments/' + OLD_ACCEPTANCE_QUOTE + '/resume', {});
      if (
        outcome.state !== 'quoted' ||
        old.prepared ||
        old.digest ||
        old.payer ||
        !outcome.progress.canCancel ||
        outcome.progress.prepared ||
        outcome.progress.submitted ||
        outcome.progress.walletAttempted ||
        outcome.progress.executionDigest
      )
        throw Error('OLD_QUOTE_NOT_SAFELY_CANCELLABLE');
      if (!reconcileOnly && !execute) throw Error('RECONCILE_EXPIRED_QUOTE_FIRST');
      const cancelled = await api<{ state: string }>(
        context,
        '/api/service-payments/' + OLD_ACCEPTANCE_QUOTE + '/cancel',
        {},
      );
      if (cancelled.state !== 'cancelled') throw Error('CANCELLATION_UNCERTAIN');
      metadata = await api<Metadata>(context, '/api/service-payments');
      if (metadata.intents.find((i) => i.id === OLD_ACCEPTANCE_QUOTE)?.state !== 'cancelled')
        throw Error('CANCELLATION_NOT_PERSISTED');
      console.log(
        'Expired quote cancelled through its owning customer session. No reservation was released.',
      );
    }
    if (reconcileOnly) return;
    if (
      !metadata.configured ||
      metadata.network !== 'sui:mainnet' ||
      !metadata.preparationAllowed ||
      !metadata.signingAllowed ||
      metadata.recoveryHolds.length ||
      metadata.intents.some((i) => ['quoted', 'approved', 'settling'].includes(i.state))
    )
      throw Error('OTHER_PAYMENT_OR_CONFIGURATION_BLOCKER');
    const allowance =
      BigInt(metadata.exposure.capAtomic) - BigInt(metadata.exposure.reservedAtomic);
    if (
      allowance < 1000000n ||
      BigInt(metadata.publicPilot.capAtomic) - BigInt(metadata.publicPilot.reservedAtomic) <
        1000000n
    )
      throw Error('INSUFFICIENT_ALLOWANCE');
    const snapshot = await api<{
      identity: { walletAddress: string };
      invoices: { id: string; number: string; vendor: string; status: string }[];
    }>(context, '/api/snapshot');
    const invoice = snapshot.invoices.find((i) => i.id === ACCEPTANCE_INVOICE);
    if (
      snapshot.identity.walletAddress !== ACCEPTANCE_PAYER ||
      invoice?.number !== 'PG-TEST-1103-01' ||
      invoice.vendor !== 'Harborline Creative Studio' ||
      invoice.status !== 'open'
    )
      throw Error('INVOICE_BINDING');
    const preflight = await api<{
      readyForQuotePreparation: boolean;
      payer: string;
      recipient: string;
      sponsor: string;
      amountAtomic: string;
      network: string;
      genesis: string;
      maxPayerGasAtomic: string;
      maxSponsorGasAtomic: string;
    }>(context, '/api/service-payments/preflight');
    if (
      !preflight.readyForQuotePreparation ||
      preflight.payer !== ACCEPTANCE_PAYER ||
      preflight.recipient !== ACCEPTANCE_MERCHANT ||
      preflight.amountAtomic !== '1000000' ||
      preflight.network !== 'sui:mainnet' ||
      preflight.genesis !== MAINNET_GENESIS ||
      preflight.maxPayerGasAtomic !== '0' ||
      preflight.maxSponsorGasAtomic !== '2000000'
    )
      throw Error('PROVIDER_PREFLIGHT_FAILED');
    const chain = new SuiGrpcClient({
      network: 'mainnet',
      baseUrl: 'https://fullnode.mainnet.sui.io:443',
    });
    const [{ chainIdentifier }, { balance }, { systemState }] = await Promise.all([
      chain.core.getChainIdentifier(),
      chain.core.getBalance({ owner: ACCEPTANCE_PAYER, coinType: SERVICE_ASSET }),
      chain.core.getCurrentSystemState(),
    ]);
    if (
      chainIdentifier !== MAINNET_GENESIS ||
      BigInt(balance.balance) < 1000000n ||
      typeof signer.signTransaction !== 'function'
    )
      throw Error('CHAIN_FUNDING_OR_SIGNER_UNAVAILABLE');
    const report = {
      checkedAt: new Date().toISOString(),
      release: release.commit,
      payer: ACCEPTANCE_PAYER,
      scheme: signer.getKeyScheme(),
      merchant: ACCEPTANCE_MERCHANT,
      sponsor: preflight.sponsor,
      amountMist: '1000000',
      maximumPayerGasMist: '0',
      allowanceMist: allowance.toString(),
      balanceMist: balance.balance,
      currentEpoch: systemState.epoch,
      recoveryEnabled: false,
      historicalCustomerRecoveries: 3,
      administratorHoldBlocksCustomer: false,
      signingMethod: 'Local test-wallet SDK; not Nightly extension',
      financialSignatures: 0,
      newQuotes: 0,
    };
    await writeFile(
      '.data/terminal-acceptance-preflight-' + Date.now() + '.json',
      JSON.stringify(report, null, 2) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
    console.log(JSON.stringify(report, null, 2));
    if (!execute) return;
    const lock = await open(journalFile, 'wx', 0o600);
    await lock.close();
    journal = { operationKey, preflight: report, signingMethod: report.signingMethod };
    await record('awaiting-begin-confirmation');
    terminal = createInterface({ input: process.stdin, output: process.stdout });
    requireTerminalApproval(
      await terminal.question('\nType BEGIN ONE PURCHASE to request exactly one fresh quote: '),
      'BEGIN ONE PURCHASE',
    );
    // This is the first and only quote request. Nothing is automatically retried.
    await record('quote-request-started');
    const raw = await api<{ id: string; expiresAt: string } & ServiceChallenge>(
      context,
      '/api/service-payments',
      { invoiceId: ACCEPTANCE_INVOICE, operationKey },
      402,
    );
    const { challenge, terms } = validateTerminalQuote(raw, preflight.sponsor);
    await record('quoted', { intentId: raw.id, quote: raw });
    const [{ systemState: current }, { balance: fundingBalance }] = await Promise.all([
      chain.core.getCurrentSystemState(),
      chain.core.getBalance({ owner: ACCEPTANCE_PAYER, coinType: SERVICE_ASSET }),
    ]);
    let funding;
    if (BigInt(fundingBalance.addressBalance) < 1000000n) {
      const coins = [];
      let cursor: string | null = null;
      for (let n = 0; n < 4; n++) {
        const page = await chain.core.listCoins({
          owner: ACCEPTANCE_PAYER,
          coinType: SERVICE_ASSET,
          limit: 50,
          cursor,
        });
        coins.push(...page.objects);
        if (!page.hasNextPage) break;
        cursor = page.cursor;
      }
      funding = selectServiceCoins(
        coins,
        ACCEPTANCE_PAYER,
        '1000000',
        fundingBalance.addressBalance,
      );
    }
    const tx = buildServiceTransaction(terms, ACCEPTANCE_PAYER, {
      genesis: chainIdentifier,
      epoch: current.epoch,
      gasPrice: current.referenceGasPrice,
      nonce: randomInt(0x100000000),
      funding,
    });
    const bytes = toBase64(await tx.build({ client: chain })),
      digest = await Transaction.from(bytes).getDigest();
    const approved = await api<{ approved: boolean; prepared: { bytes: string; digest: string } }>(
      context,
      '/api/service-payments/' + raw.id + '/approve',
      { approved: true, payer: ACCEPTANCE_PAYER, transaction: bytes },
    );
    if (
      !approved.approved ||
      approved.prepared?.bytes !== bytes ||
      approved.prepared.digest !== digest
    )
      throw Error('PREPARATION_NOT_IDENTICAL');
    const summary = await validateTerminalPreparation(bytes, digest, terms, current.epoch);
    await record('prepared', {
      digest,
      unsignedTransaction: bytes,
      summary,
      expiresAt: raw.expiresAt,
    });
    console.log(
      '\nEXACT FROZEN TRANSACTION — review before signing\n' +
        JSON.stringify({ ...summary, quoteId: raw.id, quoteExpiresAt: raw.expiresAt }, null, 2),
    );
    const remaining = Date.parse(raw.expiresAt) - Date.now() - 15000;
    if (remaining <= 0) throw Error('QUOTE_EXPIRED_BEFORE_APPROVAL');
    requireTerminalApproval(
      await terminal.question(
        '\nType SIGN ' + digest + ' to sign and submit these exact bytes ONCE: ',
        { signal: AbortSignal.timeout(remaining) },
      ),
      'SIGN ' + digest,
    );
    validateTerminalQuote(raw, preflight.sponsor);
    const { systemState: signingState } = await chain.core.getCurrentSystemState();
    await validateTerminalPreparation(bytes, digest, terms, signingState.epoch);
    await record('exact-transaction-approved');
    const signed = await signer.signTransaction(fromBase64(bytes));
    if (
      signed.bytes !== bytes ||
      (await verifyTransactionSignature(fromBase64(bytes), signed.signature)).toSuiAddress() !==
        ACCEPTANCE_PAYER
    )
      throw Error('SIGNED_BYTES_OR_IDENTITY_CONFLICT');
    await record('signed-local-sdk', {
      financialSignatures: 1,
      signatureHash: createHash('sha256').update(signed.signature).digest('hex'),
    });
    await record('single-submission-started');
    const result = await api<{
      state: string;
      digest?: string;
      diagnostic?: unknown;
      receipt?: Receipt;
    }>(context, '/api/service-payments/' + raw.id, {
      x402Version: 2,
      resource: challenge.resource,
      accepted: terms,
      payload: { transaction: bytes, signature: signed.signature },
    });
    await record('single-submission-response', { responseState: result.state });
    // Errors/ambiguous replies stop. Resume below is receipt reconciliation only, never submission.
    if (result.diagnostic || !['pending', 'settled'].includes(result.state))
      throw Error('SETTLEMENT_REQUIRES_RECONCILIATION');
    const { response: independent } = await chain.ledgerService.getTransaction({
      digest,
      readMask: {
        paths: [
          'digest',
          'effects.status',
          'transaction.sender',
          'transaction.gas_payment',
          'balance_changes',
          'checkpoint',
        ],
      },
    });
    if (!independent.transaction) throw Error('FULLNODE_FINALIZATION_UNAVAILABLE');
    const normalized = normalizeGrpcTransaction(independent.transaction);
    validateServiceSettlement(normalized, digest, terms, ACCEPTANCE_PAYER);
    const payerDelta = (normalized.balanceChanges || [])
      .filter(
        (c) =>
          typeof c.owner === 'object' &&
          'AddressOwner' in c.owner &&
          c.owner.AddressOwner === ACCEPTANCE_PAYER &&
          canonicalCoin(c.coinType) === canonicalCoin(SERVICE_ASSET),
      )
      .reduce((n, c) => n + BigInt(c.amount), 0n);
    if (payerDelta !== -1000000n) throw Error('UNEXPECTED_PAYER_DEBIT');
    const tatum = await inspectServiceSettlement(digest, terms, ACCEPTANCE_PAYER);
    const receiptResult =
      result.state === 'settled'
        ? result
        : await api<{ state: string; receipt?: Receipt }>(
            context,
            '/api/service-payments/' + raw.id + '/resume',
            {},
          );
    if (
      receiptResult.state !== 'settled' ||
      !receiptResult.receipt?.result ||
      receiptResult.receipt.digest !== digest ||
      receiptResult.receipt.intentId !== raw.id
    )
      throw Error('REPORT_OR_RECEIPT_UNCONFIRMED');
    const reopened = await api<{ state: string; receipt?: Receipt }>(
      context,
      '/api/service-payments/' + raw.id + '/resume',
      {},
    );
    if (
      reopened.state !== 'settled' ||
      reopened.receipt?.id !== receiptResult.receipt.id ||
      JSON.stringify(reopened.receipt.result) !== JSON.stringify(receiptResult.receipt.result)
    )
      throw Error('RECEIPT_REOPEN_CONFLICT');
    const after = await api<Metadata>(context, '/api/service-payments');
    if (
      BigInt(after.exposure.reservedAtomic) !==
        BigInt(metadata.exposure.reservedAtomic) + 1000000n ||
      BigInt(after.publicPilot.reservedAtomic) !==
        BigInt(metadata.publicPilot.reservedAtomic) + 1000000n
    )
      throw Error('FINAL_LIABILITY_CONFLICT');
    await record('verified-settled', {
      receipt: receiptResult.receipt,
      tatum,
      independentCheckpoint: normalized.checkpoint,
      merchantCreditMist: '1000000',
      payerDebitMist: '1000000',
      reportReopened: true,
      quoteRequests: 1,
      submissions: 1,
      nightlyExtensionFinancialAcceptance: 'not established',
    });
    console.log(
      '\nLOCAL TEST-WALLET PAYMENT VERIFIED. Digest: ' +
        digest +
        '\nReceipt: ' +
        receiptResult.receipt.id +
        '\nNightly extension financial signing remains independently unverified.',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const code = /^[A-Z_0-9]+$/.test(message) ? message : 'ACCEPTANCE_OUTCOME_UNCERTAIN';
    if (!journal)
      await writeFile(
        '.data/terminal-preflight-stop-' + Date.now() + '.json',
        JSON.stringify(
          {
            at: new Date().toISOString(),
            code,
            quoteRequests: 0,
            financialSignatures: 0,
          },
          null,
          2,
        ) + '\n',
        { flag: 'wx', mode: 0o600 },
      );
    await record('stopped-reconcile-before-any-repeat', { code });
    console.error(
      '\nSTOP: ' +
        code +
        '. Preserve this attempt. No automatic repeat, replacement, signature or submission.',
    );
    process.exitCode = 1;
  } finally {
    terminal?.close();
    await context.dispose();
  }
}
main().catch(() => {
  console.error('Acceptance runner stopped before verified completion. No secret is logged.');
  process.exitCode = 1;
});
