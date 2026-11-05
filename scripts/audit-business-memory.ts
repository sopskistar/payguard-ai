// Read-only provider audit: never remember, register, renew, seed or update a row.
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
config({ path: '.env.local', quiet: true });
async function main() {
  const { memoryClient, namespaceFor } = await import('../src/lib/integrations/memory');
  const { SuiGrpcClient } = await import('@mysten/sui/grpc');
  const { MAINNET_GENESIS } = await import('../src/lib/service-protocol');
  const chain = new SuiGrpcClient({
    network: 'mainnet',
    baseUrl: 'https://fullnode.mainnet.sui.io:443',
  });
  const [{ chainIdentifier }, { object }] = await Promise.all([
    chain.core.getChainIdentifier(),
    chain.core.getObject({ objectId: process.env.MEMWAL_ACCOUNT_ID!, include: { json: true } }),
  ]);
  const accountOwner = object.json?.owner;
  if (
    chainIdentifier !== MAINNET_GENESIS ||
    !object.type.endsWith('::account::MemWalAccount') ||
    typeof accountOwner !== 'string' ||
    object.json?.active !== true ||
    object.json?.admin_quarantined !== false
  )
    throw Error('ACCOUNT_IDENTITY_UNAVAILABLE');
  const sql = neon(process.env.DATABASE_URL!);
  const [mode, jobs] = await sql.transaction(
    [
      sql`select current_setting('transaction_read_only') as read_only`,
      sql`select j.id,j.tenant_id,j.namespace,j.job_id,j.blob_id,j.account_id,j.status,j.completed_at,j.text,r.policy from memory_jobs j left join user_rules r on r.id=j.policy_id order by j.created_at,j.id`,
    ],
    { readOnly: true, isolationLevel: 'RepeatableRead' },
  );
  if (mode[0]?.read_only !== 'on') throw Error('READ_ONLY_REQUIRED');
  const listings = new Map<
    string,
    {
      blob_id: string;
      namespace_id: string;
      status: string;
      expires_at: string | null;
      end_epoch: number | null;
    }[]
  >();
  for (const tenantId of [
    ...new Set(jobs.filter((j) => j.status === 'confirmed').map((j) => j.tenant_id)),
  ]) {
    const client = memoryClient(tenantId),
      rows = [];
    let cursor: string | undefined;
    for (let page = 0; page < 20; page++) {
      const result = await client.listMemories({
        namespace: namespaceFor(tenantId),
        limit: 100,
        cursor,
      });
      rows.push(...result.memories);
      if (!result.has_more) break;
      if (!result.next_cursor || result.next_cursor === cursor || page === 19)
        throw Error('LISTING_INCOMPLETE');
      cursor = result.next_cursor;
    }
    listings.set(tenantId, rows);
  }
  const checks: Record<string, unknown>[] = [];
  for (const row of jobs.filter((j) => j.status === 'confirmed')) {
    try {
      const status = await memoryClient(row.tenant_id).getRememberStatus(row.job_id);
      const listed = listings
        .get(row.tenant_id)
        ?.find((m) => m.blob_id === row.blob_id && m.namespace_id === row.namespace);
      checks.push({
        currentlyListed: !!listed,
        listedStatus: listed?.status || null,
        retentionEndEpoch: listed?.end_epoch ?? null,
        retentionExpiresAt: listed?.expires_at ?? null,
        expired: !!listed?.expires_at && Date.parse(listed.expires_at) <= Date.now(),
        id: row.id,
        jobId: row.job_id,
        blobId: row.blob_id,
        namespace: row.namespace,
        accountId: row.account_id,
        providerStatus: status.status,
        matchingBlob: status.blob_id === row.blob_id,
        matchingNamespace:
          status.namespace === row.namespace && row.namespace === namespaceFor(row.tenant_id),
        matchingAccount: row.account_id === process.env.MEMWAL_ACCOUNT_ID,
        matchingOwner: status.owner === accountOwner,
        superseded: !!row.policy?.supersededBy || row.policy?.active === false,
        completedAt: row.completed_at,
      });
    } catch {
      checks.push({ id: row.id, providerStatus: 'unavailable', verified: false });
    }
  }
  const verified = checks.filter(
    (c) =>
      c.providerStatus === 'done' &&
      c.matchingBlob &&
      c.matchingNamespace &&
      c.matchingAccount &&
      c.matchingOwner &&
      c.currentlyListed &&
      !c.expired,
  );
  const unconfirmedChecks: Record<string, unknown>[] = [];
  for (const row of jobs.filter((j) => j.status !== 'confirmed')) {
    if (!row.job_id) {
      unconfirmedChecks.push({
        id: row.id,
        databaseStatus: row.status,
        providerStatus: 'not-submitted',
        verified: false,
      });
      continue;
    }
    try {
      const client = memoryClient(row.tenant_id);
      const status = await client.getRememberStatus(row.job_id);
      const listed = listings
        .get(row.tenant_id)
        ?.find((m) => m.blob_id === status.blob_id && m.namespace_id === row.namespace);
      // List responses contain metadata only. Exact text needs authenticated decryption/recall.
      const recalled =
        status.status === 'done'
          ? await client.recall({ query: row.text, namespace: row.namespace, limit: 30 })
          : undefined;
      const exact = recalled?.results.find(
        (m) => m.blob_id === status.blob_id && m.text === row.text,
      );
      const valid =
        status.status === 'done' &&
        status.namespace === row.namespace &&
        row.namespace === namespaceFor(row.tenant_id) &&
        row.account_id === process.env.MEMWAL_ACCOUNT_ID &&
        status.owner === accountOwner &&
        !!listed &&
        !!exact &&
        (!listed.expires_at || Date.parse(listed.expires_at) > Date.now());
      unconfirmedChecks.push({
        id: row.id,
        databaseStatus: row.status,
        providerStatus: status.status,
        blobId: status.blob_id || null,
        namespace: row.namespace,
        currentlyListed: !!listed,
        matchingExactDecryptedText: !!exact,
        providerOwner: status.owner || null,
        verified: valid,
        applicationStatusChanged: false,
      });
    } catch {
      unconfirmedChecks.push({
        id: row.id,
        databaseStatus: row.status,
        providerStatus: 'unavailable',
        verified: false,
      });
    }
  }
  const providerDistinct = new Set([
    ...verified.map((c) => c.blobId),
    ...unconfirmedChecks.filter((c) => c.verified).map((c) => c.blobId),
  ]).size;
  const report = {
    checkedAt: new Date().toISOString(),
    readOnly: true,
    databaseRows: jobs.length,
    databaseStatuses: Object.fromEntries(
      [...new Set(jobs.map((j) => j.status))].map((s) => [
        s,
        jobs.filter((j) => j.status === s).length,
      ]),
    ),
    currentProviderListingRechecked: true,
    providerCompletedAndMatched: verified.length,
    distinctConfirmedMainnetBlobs: new Set(verified.map((c) => c.blobId)).size,
    duplicateConfirmedBlobs: verified.length - new Set(verified.map((c) => c.blobId)).size,
    supersededConfirmed: verified.filter((c) => c.superseded).length,
    checks,
    unconfirmedChecks: unconfirmedChecks.map((c) => ({
      recordFingerprint: createHash('sha256').update(String(c.id)).digest('hex'),
      databaseStatus: c.databaseStatus,
      providerStatus: c.providerStatus,
      currentlyListed: c.currentlyListed ?? false,
      matchingExactDecryptedText: c.matchingExactDecryptedText ?? false,
      verified: c.verified,
      applicationStatusChanged: false,
      privateTechnicalReferencesWithheld: true,
    })),
    distinctVerifiedProviderMainnetBlobs: providerDistinct,
    applicationConfirmedDistinctBlobs: new Set(verified.map((c) => c.blobId)).size,
    destinationAccount: process.env.MEMWAL_ACCOUNT_ID,
    accountOwner,
    canonicalChainIdentifier: chainIdentifier,
    providerWrites: 0,
    databaseMutations: 0,
    additionalDistinctTarget: Math.max(0, 50 - providerDistinct),
    allRecordedConfirmedReverified:
      verified.length === jobs.filter((j) => j.status === 'confirmed').length,
  };
  const path =
    process.env.PAYGUARD_BUSINESS_MEMORY_AUDIT ||
    'docs/evidence/business-memory-baseline-' + Date.now() + '.json';
  await writeFile(path, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(
    JSON.stringify({
      path,
      databaseRows: report.databaseRows,
      confirmed: report.distinctConfirmedMainnetBlobs,
      providerDistinct,
      additionalTarget: report.additionalDistinctTarget,
      verified: report.allRecordedConfirmedReverified,
      writes: 0,
    }),
  );
  if (!report.allRecordedConfirmedReverified) process.exitCode = 2;
}
main().catch(() => {
  console.error('Read-only memory audit incomplete. No statuses invented and no writes made.');
  process.exitCode = 1;
});
