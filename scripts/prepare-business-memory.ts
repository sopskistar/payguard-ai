// Generates a concrete review manifest. Never inserts rows or calls remember.
import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { businessLearningScenarios } from '../src/lib/business-learning-scenarios';
import type { Policy } from '../src/lib/types';
config({ path: '.env.local', quiet: true });
export function stableBusinessId(key: string) {
  const hex = createHash('sha256')
    .update('payguard-business-v2:' + key)
    .digest('hex')
    .slice(0, 32);
  return (
    hex.slice(0, 8) +
    '-' +
    hex.slice(8, 12) +
    '-5' +
    hex.slice(13, 16) +
    '-a' +
    hex.slice(17, 20) +
    '-' +
    hex.slice(20)
  );
}
async function main() {
  const { OWNER_ID } = await import('../src/lib/demo');
  const { namespaceFor, minimizedMemory } = await import('../src/lib/integrations/memory');
  const accountProof = JSON.parse(
    await readFile('docs/evidence/business-memory-account-2026-11-05.json', 'utf8'),
  );
  if (
    !accountProof.active ||
    accountProof.adminQuarantined ||
    accountProof.accountId !== process.env.MEMWAL_ACCOUNT_ID
  )
    throw Error('Account is not ready.');
  const baseline = JSON.parse(
    await readFile('docs/evidence/business-memory-provider-current.json', 'utf8'),
  );
  if (
    !baseline.allRecordedConfirmedReverified ||
    baseline.distinctVerifiedProviderMainnetBlobs !== 34 ||
    Date.now() - Date.parse(baseline.checkedAt) > 86400000
  )
    throw Error('A fresh complete baseline is required.');
  const records = businessLearningScenarios
    .filter((s) => s.id !== 'BUS-04')
    .map((s) => {
      const vendorId = stableBusinessId('vendor:' + s.supplier),
        invoiceId = stableBusinessId('invoice:' + s.id),
        policyId = stableBusinessId('policy:' + s.id);
      const policy: Policy = {
        id: policyId,
        vendorId,
        invoiceId: s.scope === 'invoice' ? invoiceId : null,
        kind: s.kind,
        value: s.value,
        text: 'Synthetic scenario ' + s.id + '. ' + s.content,
        hard: false,
        currency: 'USD',
        isDemo: true,
        scope: s.scope,
        active: s.active,
        expiresAt: s.expiresAt,
        supersededBy: s.supersededBy ? stableBusinessId('policy:' + s.supersededBy) : undefined,
      };
      const text = minimizedMemory(OWNER_ID, policy, true);
      return {
        scenarioId: s.id,
        syntheticSupplier: s.supplier,
        originalSituation: s.situation,
        syntheticHumanDecision: s.syntheticDecision,
        purpose: s.purpose,
        expectedRetrieval: s.expected,
        tenantId: OWNER_ID,
        namespace: namespaceFor(OWNER_ID),
        accountId: process.env.MEMWAL_ACCOUNT_ID,
        vendorId,
        invoiceId,
        policyId,
        operationKey: 'business-v2-' + s.id,
        policy,
        syntheticFixture: {
          vendorId,
          invoiceId,
          number: 'BUSINESS-V2-' + s.id,
          issued: '2026-11-05',
          due: '2026-12-05',
          amount: '1000',
          currency: 'USD',
          recipient: 'bank:SYNTHETIC-' + s.id,
          isDemo: true,
          memo:
            'Synthetic reviewed learning fixture ' +
            s.id +
            '. Not a supplier payment or financial acceptance.',
        },
        exactText: text,
        sha256: createHash('sha256').update(text).digest('hex'),
        utf8Bytes: Buffer.byteLength(text),
      };
    });
  const payload = {
    version: 1,
    batchId: 'payguard-business-v2-2026-11-05',
    network: 'Walrus Mainnet via existing managed relayer',
    destinationAccount: process.env.MEMWAL_ACCOUNT_ID,
    destinationOwner: accountProof.accountOwner,
    canonicalChainIdentifier: accountProof.chainIdentifier,
    namespace: namespaceFor(OWNER_ID),
    startingDistinctConfirmed: 34,
    countBasis:
      'Provider-completed, currently listed, job/namespace/account verified. Application metadata remains 33 confirmed and one pending; no existing row was changed.',
    startingApplicationConfirmed: 33,
    startingPendingDatabaseJobs: 1,
    targetDistinctConfirmed: 50,
    maxNewWrites: 16,
    totalUtf8Bytes: records.reduce((n, r) => n + r.utf8Bytes, 0),
    cost: {
      estimatedDirectSui: '0',
      estimatedDirectWal: '0',
      maximumPaidOperations: 0,
      basis:
        'Existing managed sponsored relayer. No funding, renewal, paid fallback, Sui transfer or wallet financial signature is permitted. Stop if sponsored writes are unavailable, a fee/payment is requested, or quota is exhausted.',
      retention: 'Existing provider-managed storage epochs; no automatic renewal authorized.',
    },
    records,
  };
  const sha256 = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  await writeFile(
    'docs/evidence/business-memory-proposed-batch.json',
    JSON.stringify({ sha256, ...payload }, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      manifest: 'docs/evidence/business-memory-proposed-batch.json',
      sha256,
      records: records.length,
      bytes: payload.totalUtf8Bytes,
      destinationAccount: payload.destinationAccount,
      namespace: payload.namespace,
      providerWrites: 0,
      ownerApprovalRequired: true,
    }),
  );
}
main().catch(() => {
  console.error('Manifest preparation failed; no database or provider write occurred.');
  process.exitCode = 1;
});
