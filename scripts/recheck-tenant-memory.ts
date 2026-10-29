import { config } from 'dotenv';
import { readFile, writeFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { initializeScriptHttpDatabase } from './neon-http';
config({ path: '.env.local', quiet: true });
try {
  await initializeScriptHttpDatabase();
  const { db } = await import('../src/db');
  const { memoryJobs } = await import('../src/db/schema');
  const { memoryClient } = await import('../src/lib/integrations/memory');
  const { OWNER_ID } = await import('../src/lib/demo');
  const ownerRows = await (
    await db()
  )
    .select({ status: memoryJobs.status })
    .from(memoryJobs)
    .where(eq(memoryJobs.tenantId, OWNER_ID));
  const originalOwnerConfirmed = ownerRows.filter((m) => m.status === 'confirmed').length;
  const proof = JSON.parse(await readFile('docs/evidence/two-tenant-mainnet-memory.json', 'utf8'));
  const checks = [];
  for (const t of proof.tenants as { memoryId: string; jobId: string; blobId: string }[]) {
    const [row] = await (await db()).select().from(memoryJobs).where(eq(memoryJobs.id, t.memoryId));
    if (!row || row.status !== 'confirmed' || row.jobId !== t.jobId || row.blobId !== t.blobId)
      throw new Error('Persisted proof mismatch');
    const status = await memoryClient(row.tenantId).getRememberStatus(t.jobId);
    checks.push({
      memoryId: row.id,
      jobId: t.jobId,
      blobId: t.blobId,
      namespace: row.namespace,
      completedAt: row.completedAt?.toISOString(),
      providerStatus: status.status,
      matchingBlob: status.blob_id === row.blobId,
      matchingNamespace: status.namespace === row.namespace,
    });
  }
  const report = {
    checkedAt: new Date().toISOString(),
    writes: false,
    operatorReadOnly: true,
    originalOwnerConfirmed,
    additionalChecks: checks,
    ok:
      originalOwnerConfirmed === 30 &&
      checks.length === 2 &&
      checks.every((c) => c.providerStatus === 'done' && c.matchingBlob && c.matchingNamespace),
  };
  await writeFile(
    'docs/evidence/two-tenant-provider-recheck.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify({ ok: report.ok, additionalConfirmed: checks.length, writes: false }));
  process.exit(report.ok ? 0 : 2);
} catch {
  console.error('Read-only tenant provider recheck failed. No records changed or status invented.');
  process.exit(1);
}
