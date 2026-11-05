// Read-only Production evidence. Does not import the recovery mutation or wallet clients.
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { Transaction } from '@mysten/sui/transactions';
import { readServiceExpiryEvidence } from '../src/lib/integrations/service-expiry';
import { assessServiceExpiry, EXPIRY_RULES } from '../src/lib/service-expiry';
import {
  MAINNET_GENESIS,
  serviceTermsSchema,
  validateServiceTransaction,
} from '../src/lib/service-protocol';
import { OWNER_ID } from '../src/lib/demo';

config({ path: '.env.local', quiet: true });
const postDeployIndex = process.argv.indexOf('--post-deploy');
const postDeploy = postDeployIndex !== -1;
const expectedCommit = postDeploy ? process.argv[postDeployIndex + 1] : undefined;
if (postDeploy && !/^[a-f0-9]{40}$/.test(expectedCommit || ''))
  throw Error('EXPECTED_DEPLOYED_COMMIT_REQUIRED');
const ids = [
  '544d939d-02d5-4d98-b549-69fb9fb501e8',
  'b0386342-a7c2-40ba-909e-9edf17501767',
  '7a025238-06d9-43ca-8b5f-16ef7079f086',
  'd23937ed-1907-4e40-8156-488f453a921a',
];
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const budgetHash = (value: string) => createHash('sha256').update(value).digest('hex');
const serialize = (value: unknown) =>
  JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2) + '\n';
const sql = neon(process.env.DATABASE_URL!);
async function capture() {
  const [mode, memories, receipts, intents, business, budgets, users, events, counts] =
    await sql.transaction(
      [
        sql`select current_setting('transaction_read_only') as read_only`,
        sql`select id,tenant_id,namespace,job_id,blob_id,status from memory_jobs order by id`,
        sql`select id,intent_id,digest,network,evidence,result,created_at from service_payment_receipts order by id`,
        sql`select * from service_payment_intents order by id`,
        sql`select to_jsonb(i) as invoice,to_jsonb(v) as supplier,to_jsonb(p) as trust_profile,to_jsonb(n) as instructions from invoices i join vendors v on v.id=i.vendor_id left join vendor_trust_profiles p on p.vendor_id=v.id left join payment_instructions n on n.invoice_id=i.id where i.id='7e23bb74-37bd-42d4-8530-2ce80c934620'`,
        sql`select * from service_spending_sessions order by id`,
        sql`select id,role,wallet_address from users order by id`,
        sql`select entity_id,type,detail,created_at from audit_events where entity_id=any(${ids}::text[]) order by created_at`,
        sql`select (select count(*) from audit_events where type like 'service.expiry_recover%')::int as recovery_events,(select count(*) from audit_events where type='service.settlement_requested')::int as submissions,(select count(*) from service_payment_intents where state='settling')::int as settling`,
      ],
      { readOnly: true, isolationLevel: 'RepeatableRead' },
    );
  if (mode[0]?.read_only !== 'on') throw Error('READ_ONLY_REQUIRED');
  return {
    memories,
    receipts,
    intents,
    business,
    budgets,
    users,
    events,
    counts,
    fingerprint: {
      memories: hash(memories),
      receipts: hash(receipts),
      intents: hash(intents.filter((i) => ids.includes(i.id))),
      business: hash(business),
      budgets: hash(budgets),
      providerAndWalletHistory: hash(events),
      allIntents: hash(intents),
    },
  };
}
try {
  const before = await capture();
  const old = JSON.parse(await readFile('docs/evidence/nightly-account-preservation.json', 'utf8'));
  const priorEligibility = JSON.parse(
    await readFile('docs/evidence/tatum-history-eligibility-2026-11-05.json', 'utf8'),
  );
  const unchangedSincePriorEligibility = Object.fromEntries(
    Object.entries(before.fingerprint).map(([key, value]) => [
      key,
      value === priorEligibility.preservation.fingerprints[key],
    ]),
  );
  const historicalUnchanged = Object.fromEntries(
    ['memories', 'receipts', 'intents', 'business'].map((key) => [
      key,
      before.fingerprint[key as keyof typeof before.fingerprint] === old.afterFingerprints[key],
    ]),
  );
  const original = JSON.parse(
    await readFile('docs/evidence/final-audit-mainnet-readonly.json', 'utf8'),
  );
  const originalMemoryTuplesPreserved = original.providerChecks.every(
    (p: { id: string; jobId: string; blobId: string; namespace: string }) =>
      before.memories.some(
        (m) =>
          m.id === p.id &&
          m.job_id === p.jobId &&
          m.blob_id === p.blobId &&
          m.namespace === p.namespace &&
          m.status === 'confirmed',
      ),
  );
  const reports = [];
  for (const id of ids) {
    const row = before.intents.find((i) => i.id === id);
    if (!row) throw Error('ORIGINAL_INTENT_MISSING');
    const actor = before.users.find((u) => u.id === row.tenant_id);
    const reasons: string[] = [];
    const terms = serviceTermsSchema.parse(row.challenge.accepts[0]);
    const prepared = row.approval?.prepared as { bytes: string; digest: string } | undefined;
    if (!prepared || !row.payer || !actor) throw Error('PREPARATION_MISSING');
    validateServiceTransaction(prepared.bytes, terms, row.payer);
    const transaction = Transaction.from(prepared.bytes);
    const digestMatches = (await transaction.getDigest()) === prepared.digest;
    const expiry = transaction.getData().expiration;
    if (
      expiry?.$kind !== 'ValidDuring' ||
      expiry.ValidDuring.minEpoch === null ||
      expiry.ValidDuring.maxEpoch === null ||
      expiry.ValidDuring.minTimestamp !== null ||
      expiry.ValidDuring.maxTimestamp !== null ||
      expiry.ValidDuring.chain !== MAINNET_GENESIS
    )
      throw Error('UNSUPPORTED_VALIDITY');
    const window = {
      digest: prepared.digest,
      minEpoch: String(expiry.ValidDuring.minEpoch),
      maxEpoch: String(expiry.ValidDuring.maxEpoch),
    };
    const events = before.events.filter((e) => e.entity_id === id);
    if (!digestMatches) reasons.push('PREPARED_DIGEST_MISMATCH');
    if (
      row.state !== 'approved' ||
      !row.spending_session_id ||
      !row.approved_at ||
      before.receipts.some((r) => r.intent_id === id || r.digest === prepared.digest)
    )
      reasons.push('INTENT_NOT_RECOVERABLE');
    if (
      row.digest ||
      row.payload_hash ||
      events.some(
        (e) =>
          e.type.startsWith('service.settlement_') || e.type.startsWith('service.confirmation_'),
      )
    )
      reasons.push('SUBMISSION_REQUIRES_RECONCILIATION');
    if (
      terms.network !== 'sui:mainnet' ||
      terms.extra.quoteId !== id ||
      !['owner', 'member'].includes(actor.role) ||
      (row.tenant_id !== OWNER_ID &&
        (actor.role !== 'member' ||
          actor.wallet_address !== row.payer ||
          (terms.extra.authenticatedPayer && terms.extra.authenticatedPayer !== row.payer) ||
          row.spending_session_id !==
            budgetHash(row.tenant_id + ':authenticated-wallet-pilot-v1:' + terms.network)))
    )
      reasons.push('PAYER_OR_NETWORK_MISMATCH');
    const budgetIds = [row.spending_session_id];
    if (row.tenant_id !== OWNER_ID)
      budgetIds.unshift(budgetHash('payguard:public-sponsored-pilot:v1:' + terms.network));
    const reservations = budgetIds.map((budgetId, index) => {
      const publicBudget = row.tenant_id !== OWNER_ID && index === 0;
      const budget = before.budgets.find((b) => b.id === budgetId);
      let liability = 0n;
      let valid = !!budget;
      for (const item of before.intents) {
        if (
          !item.spending_session_id ||
          ['cancelled', 'expired-unexecuted'].includes(item.state) ||
          (publicBudget ? item.tenant_id === OWNER_ID : item.spending_session_id !== budgetId)
        )
          continue;
        const t = serviceTermsSchema.parse(item.challenge.accepts[0]);
        if (t.network !== terms.network) continue;
        if (
          !item.approved_at ||
          !['approved', 'settling', 'settled', 'failed'].includes(item.state)
        )
          valid = false;
        liability += BigInt(t.amount);
      }
      valid =
        valid &&
        budget!.network === terms.network &&
        budget!.asset === terms.asset &&
        budget!.tenant_id === (publicBudget ? OWNER_ID : row.tenant_id) &&
        budget!.payer === (publicBudget ? 'public-sponsored-pilot-ledger' : row.payer) &&
        BigInt(budget!.reserved_atomic) === liability &&
        liability >= BigInt(terms.amount) &&
        liability <= BigInt(budget!.cap_atomic);
      if (!valid) reasons.push('BUDGET_LIABILITY_CONFLICT');
      return {
        ledger: publicBudget ? 'public-sponsorship' : 'original-wallet-or-session',
        reservedAtomic: budget?.reserved_atomic,
        liabilityAtomic: liability.toString(),
        capAtomic: budget?.cap_atomic,
        accountingAgrees: valid,
        wouldReleaseAtomic: terms.amount,
        proposedAfterThisIntentAtomic: budget
          ? (BigInt(budget.reserved_atomic) - BigInt(terms.amount)).toString()
          : null,
      };
    });
    const providerEvidence = await readServiceExpiryEvidence(window);
    const chainDecision = assessServiceExpiry(window, providerEvidence);
    if (!chainDecision.eligible) reasons.push(chainDecision.reason);
    const report = {
      id,
      role: actor.role,
      owningWorkspace: {
        role: actor.role,
        referenceSha256: hash(row.tenant_id),
        authenticatedWallet: actor.wallet_address,
        recordedPayer: row.payer,
        preparedSender: transaction.getData().sender,
        quotePayer: terms.extra.authenticatedPayer || null,
        isOriginalAdministratorWorkspace: row.tenant_id === OWNER_ID,
      },
      state: row.state,
      digest: prepared.digest,
      window,
      preparedDigestMatchesBytes: digestMatches,
      preparationValidated: true,
      currentMainnetEpoch: providerEvidence.map((e) => ({ provider: e.provider, epoch: e.epoch })),
      reservationAtomic: terms.amount,
      reservations,
      providerEvidence,
      chainDecision,
      payloadPersisted: !!row.payload_hash,
      executionDigest: row.digest,
      auditHistory: events.map((e) => ({ type: e.type, at: e.created_at })),
      originalRecordSha256: hash(row),
      walletEvents: events
        .filter((e) => e.type.startsWith('service.wallet_'))
        .map((e) => ({ type: e.type, at: e.created_at, code: e.detail?.diagnostic?.code || null })),
      eligibleAtObservation: reasons.length === 0,
      reasons,
      remainingUncertainty:
        'Dated read-only eligibility; recovery must repeat all checks under row locks with fresh evidence. No cryptographic non-inclusion proof or physical financial-signing certification.',
    };
    reports.push(report);
    console.log(
      JSON.stringify({
        id,
        digest: prepared.digest,
        eligible: report.eligibleAtObservation,
        reasons,
      }),
    );
  }
  const after = await capture();
  const unchanged = Object.fromEntries(
    Object.entries(before.fingerprint).map(([key, value]) => [
      key,
      after.fingerprint[key as keyof typeof after.fingerprint] === value,
    ]),
  );
  const releaseResponse = await fetch('https://payguard-ai-henna.vercel.app/api/release');
  const release = releaseResponse.ok
    ? await releaseResponse.json()
    : { httpStatus: releaseResponse.status };
  const report = {
    checkedAt: new Date().toISOString(),
    readOnly: true,
    databaseTransactionMode: 'READ ONLY REPEATABLE READ',
    productionRelease: release,
    expectedDeployedCommit: expectedCommit || null,
    deployedCommitMatches: expectedCommit ? release.commit === expectedCommit : null,
    dataAccess:
      'Authorized operator database audit in enforced READ ONLY transactions; no customer endpoint or impersonated session',
    rules: EXPIRY_RULES,
    endpoints: {
      tatum: 'sui-mainnet-grpc.gateway.tatum.io:443',
      'sui-fullnode': 'fullnode.mainnet.sui.io:443',
    },
    historicalEvidenceMethod:
      'Existing independent LedgerService.GetEpoch/GetCheckpoint/GetTransaction with shared Tatum pacing; no source substitution',
    intents: reports,
    allEligibleAtObservation:
      reports.every((r) => r.eligibleAtObservation) &&
      Object.values(unchanged).every(Boolean) &&
      Object.values(unchangedSincePriorEligibility).every(Boolean),
    preservation: {
      historicalUnchanged,
      originalMemoryTuplesPreserved,
      unchangedDuringAudit: unchanged,
      unchangedSincePriorEligibility,
      priorEligibilityCheckedAt: priorEligibility.checkedAt,
      fingerprints: after.fingerprint,
      confirmedMemories: after.memories.filter((m) => m.status === 'confirmed').length,
      memoryRows: after.memories.length,
      receiptsAndReports: after.receipts.length,
      originalIntents: reports.length,
      harborlineRecords: after.business.length,
      counts: after.counts,
    },
    productionRecoveryInvocations: 0,
    configurationChanges: 0,
    recordMutations: 0,
    financialSignatures: 0,
    newQuotes: 0,
    transactionPreparations: 0,
    transactionSubmissions: 0,
    walrusWrites: 0,
    safeForNewCheckoutNow: false,
    nextStep:
      'Separate explicit approval of four specific recoveries after deployment review; repeat fresh chain and liability checks. Holds are unchanged.',
  };
  await writeFile(
    postDeploy
      ? 'docs/evidence/tatum-deployed-eligibility-2026-11-05.json'
      : 'docs/evidence/tatum-history-eligibility-2026-11-05.json',
    serialize(report),
  );
  if (
    !Object.values(unchanged).every(Boolean) ||
    !Object.values(historicalUnchanged).every(Boolean) ||
    !Object.values(unchangedSincePriorEligibility).every(Boolean) ||
    (expectedCommit && release.commit !== expectedCommit) ||
    !originalMemoryTuplesPreserved
  )
    throw Error('PRESERVATION_CONFLICT');
} catch {
  console.error(
    'Read-only expiry history audit incomplete. No recovery or provider writes were invoked; inspect the safe report if present.',
  );
  process.exitCode = 1;
}
