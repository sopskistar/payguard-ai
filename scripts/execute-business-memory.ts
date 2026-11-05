// Explicitly approved exact batch only. No Sui payment, renewal or financial key path.
import { config } from 'dotenv';
import { readFile, writeFile } from 'node:fs/promises';
import { and, eq } from 'drizzle-orm';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { MAINNET_GENESIS } from '../src/lib/service-protocol';
import { createHash } from 'node:crypto';
import { validateBusinessBatch } from '../src/lib/business-memory-batch';
import { initializeScriptHttpDatabase } from './neon-http';
config({ path: '.env.local', quiet: true });
async function main() {
  if (process.argv.includes('--http')) throw Error('TRANSACTIONAL_DATABASE_REQUIRED');
  const approved = process.argv[process.argv.indexOf('--approved-sha') + 1];
  if (!process.argv.includes('--execute') || !process.argv.includes('--approved-sha'))
    throw Error('EXPLICIT_BATCH_APPROVAL_REQUIRED');
  const { OWNER_ID } = await import('../src/lib/demo');
  const { memoryClient, namespaceFor, processMemoryJob, minimizedMemory } =
    await import('../src/lib/integrations/memory');
  const batch = validateBusinessBatch(
    JSON.parse(await readFile('docs/evidence/business-memory-proposed-batch.json', 'utf8')),
    approved,
    {
      account: process.env.MEMWAL_ACCOUNT_ID!,
      tenant: OWNER_ID,
      namespace: namespaceFor(OWNER_ID),
    },
  );
  if (!batch.records.every((r) => minimizedMemory(OWNER_ID, r.policy, true) === r.exactText))
    throw Error('EXACT_CONTENT_CHANGED');
  await initializeScriptHttpDatabase();
  const { db } = await import('../src/db');
  const s = await import('../src/db/schema');
  const d = await db();
  const originalBaseline = JSON.parse(
    await readFile('.data/controlled-recovery-baseline-20261105.json', 'utf8'),
  );
  async function preserve() {
    const all = await d
      .select({
        id: s.memoryJobs.id,
        tenant_id: s.memoryJobs.tenantId,
        namespace: s.memoryJobs.namespace,
        job_id: s.memoryJobs.jobId,
        blob_id: s.memoryJobs.blobId,
        status: s.memoryJobs.status,
        operationKey: s.memoryJobs.operationKey,
      })
      .from(s.memoryJobs)
      .orderBy(s.memoryJobs.id);
    const original = all
      .filter((j) => !j.operationKey.startsWith('business-v2-'))
      .map(({ operationKey, ...v }) => {
        void operationKey;
        return v;
      });
    if (
      createHash('sha256').update(JSON.stringify(original)).digest('hex') !==
      originalBaseline.protected.memories
    )
      throw Error('ORIGINAL_MEMORY_CHANGED');
  }
  await preserve();
  const chain = new SuiGrpcClient({
    network: 'mainnet',
    baseUrl: 'https://fullnode.mainnet.sui.io:443',
  });
  const [{ chainIdentifier }, { object }] = await Promise.all([
    chain.core.getChainIdentifier(),
    chain.core.getObject({ objectId: batch.destinationAccount, include: { json: true } }),
  ]);
  if (
    chainIdentifier !== MAINNET_GENESIS ||
    chainIdentifier !== batch.canonicalChainIdentifier ||
    object.json?.owner !== batch.destinationOwner ||
    !object.type.endsWith('::account::MemWalAccount') ||
    typeof object.json?.owner !== 'string' ||
    object.json.active !== true ||
    object.json.admin_quarantined !== false
  )
    throw Error('ACCOUNT_OWNERSHIP_UNAVAILABLE');
  const expectedOwner = object.json.owner;
  const client = memoryClient(OWNER_ID);
  const health = await client.health();
  if (health.write_ready === false) throw Error('SPONSORED_RELAYER_UNAVAILABLE');
  const results = [];
  for (const row of batch.records) {
    await preserve();
    let [job] = await d
      .select()
      .from(s.memoryJobs)
      .where(
        and(eq(s.memoryJobs.tenantId, OWNER_ID), eq(s.memoryJobs.operationKey, row.operationKey)),
      );
    if (!job) {
      const confirmed = await d
        .select({ blobId: s.memoryJobs.blobId })
        .from(s.memoryJobs)
        .where(eq(s.memoryJobs.status, 'confirmed'));
      if (new Set(confirmed.map((j) => j.blobId)).size >= 50) throw Error('TARGET_ALREADY_REACHED');
      job = await d.transaction(async (tx) => {
        await tx
          .insert(s.vendors)
          .values({
            id: row.vendorId,
            tenantId: OWNER_ID,
            name: row.syntheticSupplier,
            normalizedName: row.syntheticSupplier.toLowerCase(),
            isDemo: true,
          })
          .onConflictDoNothing();
        await tx
          .insert(s.invoices)
          .values({
            id: row.invoiceId,
            tenantId: OWNER_ID,
            vendorId: row.vendorId,
            number: row.syntheticFixture.number,
            issued: row.syntheticFixture.issued,
            due: row.syntheticFixture.due,
            amount: row.syntheticFixture.amount,
            currency: row.syntheticFixture.currency,
            recipient: row.syntheticFixture.recipient,
            memo: row.syntheticFixture.memo,
            source: 'manual',
            isDemo: true,
            importKey: row.invoiceId,
          })
          .onConflictDoNothing();
        await tx.insert(s.userRules).values({
          id: row.policyId,
          tenantId: OWNER_ID,
          vendorId: row.vendorId,
          invoiceId: row.policy.invoiceId,
          policy: row.policy,
        });
        const [created] = await tx
          .insert(s.memoryJobs)
          .values({
            tenantId: OWNER_ID,
            invoiceId: row.invoiceId,
            policyId: row.policyId,
            operationKey: row.operationKey,
            namespace: row.namespace,
            intent: 'Owner-approved synthetic business learning ' + row.scenarioId,
            text: row.exactText,
            accountId: row.accountId,
            isDemo: true,
          })
          .returning();
        await tx.insert(s.auditEvents).values({
          tenantId: OWNER_ID,
          type: 'memory.business_batch_prepared',
          entityId: created.id,
          detail: {
            manifestSha: batch.sha256,
            scenarioId: row.scenarioId,
            synthetic: true,
            paidOperationsAuthorized: 0,
          },
        });
        return created;
      });
    }
    if (
      job.text !== row.exactText ||
      job.namespace !== row.namespace ||
      job.accountId !== row.accountId ||
      !job.isDemo
    )
      throw Error('EXISTING_JOB_CONFLICT');
    const result = await processMemoryJob(OWNER_ID, job.id);
    if (result.status !== 'confirmed' || !result.jobId || !result.blobId)
      throw Error('JOB_NOT_CONFIRMED_STOP');
    const proof = await client.getRememberStatus(result.jobId);
    if (
      proof.status !== 'done' ||
      proof.blob_id !== result.blobId ||
      proof.namespace !== row.namespace ||
      proof.owner !== expectedOwner
    )
      throw Error('PROVIDER_PROOF_CONFLICT');
    results.push({
      scenarioId: row.scenarioId,
      memoryId: result.id,
      jobId: result.jobId,
      blobId: result.blobId,
      namespace: result.namespace,
      providerStatus: proof.status,
      owner: proof.owner,
    });
    await writeFile(
      '.data/business-memory-operation.json',
      JSON.stringify(
        { manifestSha: batch.sha256, checkedAt: new Date().toISOString(), results },
        null,
        2,
      ) + '\n',
    );
  }
  await preserve();
  if (new Set(results.map((r) => r.blobId)).size !== 17) throw Error('DUPLICATE_NEW_BLOB');
  const path = 'docs/evidence/business-memory-execution-' + Date.now() + '.json';
  await writeFile(
    path,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        manifestSha: batch.sha256,
        results,
        confirmedNewDistinct: 17,
        financialTransactions: 0,
        paidOperations: 0,
        originalMemoriesPreserved: true,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(JSON.stringify({ path, confirmedNewDistinct: 17, financialTransactions: 0 }));
}
main().catch((error) => {
  const code = /^[A-Z_]+$/.test(error?.message) ? error.message : 'BATCH_UNCERTAIN';
  console.error(
    JSON.stringify({
      code,
      stopped: true,
      message:
        'No replacement batch, funding or automatic retry is authorized. Reconcile original accepted jobs before continuation.',
    }),
  );
  process.exitCode = 1;
});
