import { config } from 'dotenv';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
config({ path: '.env.local', quiet: true });
async function main() {
  const { learningEvents } = await import('../src/lib/learning-events');
  const { db } = await import('../src/db');
  const s = await import('../src/db/schema');
  const { OWNER_ID } = await import('../src/lib/demo');
  const { listInvoices } = await import('../src/lib/store');
  const { processMemoryJob, minimizedMemory, namespaceFor } =
    await import('../src/lib/integrations/memory');
  const preflight = JSON.parse(await readFile('.data/release-preflight.json', 'utf8'));
  if (
    Date.now() - Date.parse(preflight.checkedAt) > 3600000 ||
    preflight.statuses.some(
      (j: { matchingBlob: boolean; providerStatus: string }) =>
        !j.matchingBlob || j.providerStatus !== 'done',
    )
  )
    throw new Error('Run read-only preflight first');
  const d = await db();
  const existing = await d.select().from(s.memoryJobs).where(eq(s.memoryJobs.tenantId, OWNER_ID));
  console.log(
    JSON.stringify({
      sponsoredManagedRelayer: true,
      maxNewOperations: 17,
      existingConfirmed: existing.filter((j) => j.status === 'confirmed').length,
      requestedTarget: 30,
      renewalAutomatic: false,
      dryRun: !process.argv.includes('--execute'),
    }),
  );
  if (!process.argv.includes('--execute')) process.exit(0);
  const invoices = await listInvoices(OWNER_ID);
  const names = ['Northstar Studio', 'Orbit Hosting', 'Forma Legal', 'Lumen Research'];
  for (const event of learningEvents) {
    const operationKey = 'competitive-v1-' + event.key;
    let job = (
      await d
        .select()
        .from(s.memoryJobs)
        .where(
          and(eq(s.memoryJobs.tenantId, OWNER_ID), eq(s.memoryJobs.operationKey, operationKey)),
        )
    )[0];
    if (!job) {
      const all = await d.select().from(s.memoryJobs).where(eq(s.memoryJobs.tenantId, OWNER_ID));
      if (all.length >= 30) {
        console.log('30 durable operations already exist; no additional writes prepared.');
        break;
      }
      const invoice = invoices.find((i) => i.isDemo && i.vendor === names[event.vendor])!;
      const id = randomUUID();
      const policy = {
        id,
        vendorId: invoice.vendorId,
        invoiceId: event.invoiceOnly ? invoice.id : null,
        kind: event.kind,
        value: event.value,
        text: event.text,
        hard: false,
        currency: 'USD',
        isDemo: true,
        scope: event.invoiceOnly ? ('invoice' as const) : ('vendor' as const),
        active: !event.superseded,
        expiresAt: event.expired
          ? '2026-10-01T00:00:00.000Z'
          : event.invoiceOnly
            ? '2026-11-10T00:00:00.000Z'
            : undefined,
        supersededBy: event.superseded ? 'competitive-v1-forma-threshold-new' : undefined,
      };
      job = await d.transaction(async (tx) => {
        await tx.insert(s.userRules).values({
          id,
          tenantId: OWNER_ID,
          vendorId: invoice.vendorId,
          invoiceId: policy.invoiceId,
          policy,
        });
        const [j] = await tx
          .insert(s.memoryJobs)
          .values({
            tenantId: OWNER_ID,
            invoiceId: invoice.id,
            policyId: id,
            operationKey,
            namespace: namespaceFor(OWNER_ID),
            intent: 'Synthetic learning event: ' + event.key,
            text: minimizedMemory(OWNER_ID, policy, true),
            accountId: process.env.MEMWAL_ACCOUNT_ID,
            isDemo: true,
          })
          .returning();
        return j;
      });
    }
    const result = await processMemoryJob(OWNER_ID, job.id);
    console.log(
      JSON.stringify({
        event: event.key,
        status: result.status,
        jobId: result.jobId,
        blobId: result.blobId,
      }),
    );
    if (result.error?.includes('limit')) break;
  }
  const all = await d.select().from(s.memoryJobs).where(eq(s.memoryJobs.tenantId, OWNER_ID));
  const summary = {
    checkedAt: new Date().toISOString(),
    confirmed: all.filter((j) => j.status === 'confirmed' && j.blobId && j.jobId).length,
    pending: all.filter((j) => j.status === 'pending').length,
    failed: all.filter((j) => j.status === 'failed').length,
  };
  await writeFile('.data/expansion-result.json', JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
  process.exit(summary.confirmed >= 30 ? 0 : 2);
}
main().catch(() => {
  console.error(
    'Expansion stopped; existing operations preserved. Inspect provider/quota or database state before resuming.',
  );
  process.exit(1);
});
