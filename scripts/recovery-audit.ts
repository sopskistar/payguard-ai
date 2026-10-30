import { config } from 'dotenv';
import { writeFile } from 'node:fs/promises';
import { count, eq } from 'drizzle-orm';
import { initializeScriptHttpDatabase } from './neon-http';
config({ path: '.env.local', quiet: true });
try {
  await initializeScriptHttpDatabase();
  const { db } = await import('../src/db');
  const { memoryJobs, servicePaymentReceipts } = await import('../src/db/schema');
  const { memoryClient } = await import('../src/lib/integrations/memory');
  const { OWNER_ID } = await import('../src/lib/demo');
  const rows = await (
    await db()
  )
    .select()
    .from(memoryJobs)
    .where(eq(memoryJobs.status, 'confirmed'));
  const [{ receipts }] = await (
    await db()
  )
    .select({ receipts: count() })
    .from(servicePaymentReceipts);
  const checks = [];
  for (const row of rows) {
    if (!row.jobId || !row.blobId) throw new Error('Incomplete stored memory evidence');
    const actual = await memoryClient(row.tenantId).getRememberStatus(row.jobId);
    checks.push({
      jobId: row.jobId,
      blobId: row.blobId,
      completed: actual.status === 'done',
      matchingBlob: actual.blob_id === row.blobId,
      matchingNamespace: actual.namespace === row.namespace,
    });
  }
  const report = {
    checkedAt: new Date().toISOString(),
    writes: false,
    signatures: false,
    payments: false,
    ownerConfirmed: rows.filter((r) => r.tenantId === OWNER_ID).length,
    otherConfirmed: rows.filter((r) => r.tenantId !== OWNER_ID).length,
    totalConfirmed: rows.length,
    genuineServiceReceipts: receipts,
    checks,
    ok:
      rows.length === 32 &&
      rows.filter((r) => r.tenantId === OWNER_ID).length === 30 &&
      checks.every((c) => c.completed && c.matchingBlob && c.matchingNamespace),
  };
  await writeFile(
    'docs/evidence/session-recovery-audit.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      ...report,
      checks: `${checks.length} SDK job/blob/namespace checks; details in evidence`,
    }),
  );
  process.exit(report.ok ? 0 : 2);
} catch {
  console.error('Read-only recovery audit incomplete. No database or provider records changed.');
  process.exit(1);
}
