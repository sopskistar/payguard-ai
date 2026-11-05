// Read-only provider audit: never remember, register, renew, seed or update a row.
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { writeFile } from 'node:fs/promises';
config({ path: '.env.local', quiet: true });
async function main() {
  const { memoryClient, namespaceFor } = await import('../src/lib/integrations/memory');
  const sql = neon(process.env.DATABASE_URL!);
  const [mode, jobs] = await sql.transaction(
    [
      sql`select current_setting('transaction_read_only') as read_only`,
      sql`select j.id,j.tenant_id,j.namespace,j.job_id,j.blob_id,j.account_id,j.status,j.completed_at,r.policy from memory_jobs j left join user_rules r on r.id=j.policy_id order by j.created_at,j.id`,
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
      c.currentlyListed &&
      !c.expired,
  );
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
    destinationAccount: process.env.MEMWAL_ACCOUNT_ID,
    providerWrites: 0,
    databaseMutations: 0,
    additionalDistinctTarget: Math.max(0, 50 - new Set(verified.map((c) => c.blobId)).size),
    allRecordedConfirmedReverified:
      verified.length === jobs.filter((j) => j.status === 'confirmed').length,
  };
  const path = 'docs/evidence/business-memory-baseline-' + Date.now() + '.json';
  await writeFile(path, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(
    JSON.stringify({
      path,
      databaseRows: report.databaseRows,
      confirmed: report.distinctConfirmedMainnetBlobs,
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
