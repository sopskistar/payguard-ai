import { config } from 'dotenv';
import { writeFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { initializeScriptHttpDatabase } from './neon-http';
config({ path: '.env.local', quiet: true });
async function main() {
  await initializeScriptHttpDatabase();
  const { db } = await import('../src/db');
  const s = await import('../src/db/schema');
  const { OWNER_ID } = await import('../src/lib/demo');
  const { memoryClient, namespaceFor } = await import('../src/lib/integrations/memory');
  const jobs = await (
    await db()
  )
    .select()
    .from(s.memoryJobs)
    .where(eq(s.memoryJobs.tenantId, OWNER_ID));
  const client = memoryClient(OWNER_ID);
  const statuses = [];
  for (const j of jobs.filter((j) => j.status === 'confirmed')) {
    const r = await client.getRememberStatus(j.jobId!);
    statuses.push({
      id: j.id,
      jobId: j.jobId,
      blobId: j.blobId,
      providerStatus: r.status,
      matchingBlob: r.blob_id === j.blobId,
    });
  }
  const listing = await client.listMemories({ namespace: namespaceFor(OWNER_ID), limit: 100 });
  const report = {
    checkedAt: new Date().toISOString(),
    database: 'Neon connected',
    confirmed: statuses.length,
    statuses,
    retention: listing.memories.map((m) => ({
      blobId: m.blob_id,
      endEpoch: m.end_epoch,
      expiresAt: m.expires_at,
      size: m.size,
    })),
    costModel:
      'Managed Mainnet relayer sponsored; no funding or renewal submitted; quotas still enforced',
    maxAdditionalOperations: Math.max(0, 30 - jobs.length),
  };
  await writeFile('.data/release-preflight.json', JSON.stringify(report, null, 2));
  if (process.argv.includes('--publish'))
    await writeFile('docs/evidence/provider-recheck.json', JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      confirmed: report.confirmed,
      allProviderCompleted: statuses.every((j) => j.providerStatus === 'done' && j.matchingBlob),
      retentionRows: report.retention.length,
    }),
  );
  process.exit(statuses.every((j) => j.providerStatus === 'done' && j.matchingBlob) ? 0 : 2);
}
main().catch(() => {
  console.error('Read-only memory preflight failed; no provider status invented.');
  process.exit(1);
});
