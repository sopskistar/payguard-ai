// Capture existing synthetic records only. Never creates invoices, memories or payments.
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { request } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import type { Assessment, Snapshot } from '../src/lib/types';
import { memoryClient } from '../src/lib/integrations/memory';
import { OWNER_ID } from '../src/lib/demo';
config({ path: '.env.local', quiet: true });
const sql = neon(process.env.DATABASE_URL!);
const origin = process.env.COURTROOM_CAPTURE_ORIGIN || 'http://localhost:4320';
const output = 'docs/evidence/courtroom.json';
const client = await request.newContext({ baseURL: origin });
async function call(path: string, body?: unknown, context = client) {
  const r =
    body === undefined
      ? await context.get('/api/' + path)
      : await context.post('/api/' + path, { headers: { origin }, data: body });
  if (!r.ok()) throw Error(`Courtroom capture ${path}: HTTP ${r.status()}`);
  return r.json();
}
try {
  await call('auth/login', { password: process.env.OWNER_PASSWORD });
  const snapshot: Snapshot = await call('snapshot');
  const metadata = await call('service-payments');
  const scenarios: {
    number: string;
    supplier: string;
    memo: string;
    recipient: string;
    capturedAt: string;
    source: string;
    off: Assessment;
    on: Assessment;
    gate: { allowed: boolean; reason: string };
  }[] = [];
  for (const number of ['X402-OWNER-20261031-01', 'X402-EXPERIMENT-02', 'X402-EXPERIMENT-03']) {
    const invoice = snapshot.invoices.find((i) => i.number === number && i.isDemo);
    if (!invoice) throw Error('Existing approved synthetic invoice missing');
    const off: Assessment = await call('review', { invoiceId: invoice.id, memoryOn: false });
    const on: Assessment = await call('review', { invoiceId: invoice.id, memoryOn: true });
    const context = await call('instructions/context', { invoiceId: invoice.id });
    if (
      off.citations.length ||
      !on.citations.length ||
      context.gate.allowed ||
      !off.findings.every((f) => on.findings.some((g) => g.id === f.id))
    )
      throw Error('Recall/mandatory hold contract failed; preserve previous artifact');
    scenarios.push({
      number,
      supplier: invoice.vendor,
      memo: invoice.memo,
      recipient: invoice.recipient,
      capturedAt: new Date().toISOString(),
      source:
        'Captured authenticated application reviews; same invoice, evaluate/instructionSignals/approvalGate engine',
      off,
      on,
      gate: { allowed: context.gate.allowed, reason: context.gate.reason },
    });
  }
  const reopened = [];
  for (const intent of metadata.intents.filter((i: { state: string }) => i.state === 'settled')) {
    const a = await call(`service-payments/${intent.id}/resume`, {}),
      b = await call(`service-payments/${intent.id}/resume`, {});
    if (a.receipt.id !== b.receipt.id || a.receipt.digest !== b.receipt.digest)
      throw Error('Receipt reopening mismatch');
    reopened.push({ quoteId: intent.id, digest: a.receipt.digest, sameReceipt: true });
  }
  await call('auth/logout', {});
  const fresh = await request.newContext({ baseURL: origin });
  let freshRecall;
  try {
    await call('auth/login', { password: process.env.OWNER_PASSWORD }, fresh);
    const invoice = snapshot.invoices.find((i) => i.number === 'X402-EXPERIMENT-03')!;
    const result: Assessment = await call(
      'review',
      { invoiceId: invoice.id, memoryOn: true },
      fresh,
    );
    freshRecall = {
      capturedAt: new Date().toISOString(),
      newAuthenticatedContext: true,
      number: invoice.number,
      citations: result.citations,
      exactBlobRecalledAgain: result.citations.some((c) =>
        scenarios[2].on.citations.some((p) => p.blobId === c.blobId),
      ),
    };
    if (!freshRecall.exactBlobRecalledAgain)
      throw Error('Fresh recall did not confirm a previously recalled blob');
  } finally {
    await call('auth/logout', {}, fresh).catch(() => {});
    await fresh.dispose();
  }
  const all =
    await sql`select id,tenant_id,namespace,job_id,blob_id,status,is_demo from memory_jobs where status='confirmed'`;
  if (all.length !== 32) throw Error('Confirmed count changed: inspect before publishing');
  const statuses = [];
  for (const job of all) {
    const status = await memoryClient(job.tenant_id).getRememberStatus(job.job_id);
    statuses.push({ confirmed: status.status === 'done' && status.blob_id === job.blob_id });
  }
  if (!statuses.every((s) => s.confirmed)) throw Error('Walrus provider status mismatch');
  const cited = new Set(scenarios.flatMap((s) => s.on.citations.map((c) => c.id)));
  const jobs =
    await sql`select m.id,m.job_id,m.blob_id,m.namespace,m.created_at,m.completed_at,m.is_demo,d.created_at as correction_at,d.future,d.action,i.number as source_invoice,(select min(a.created_at) from audit_events a where a.entity_id=m.invoice_id::text and a.type='review.evaluated' and a.created_at<=d.created_at) as reviewed_at from memory_jobs m left join user_rules r on r.id=m.policy_id left join review_decisions d on d.id=r.decision_id left join invoices i on i.id=m.invoice_id where m.tenant_id=${OWNER_ID} and m.status='confirmed' and m.is_demo=true`;
  const citations = jobs.filter((j) => cited.has(j.id));
  const correction = citations.find((j) => j.correction_at && j.future && j.reviewed_at);
  if (!correction) throw Error('No genuine cited human correction timeline found');
  const report = {
    capturedAt: new Date().toISOString(),
    mode: 'Public replay of dated genuine reads; no anonymous provider calls',
    syntheticBusinessScenarios: true,
    memoryWrites: false,
    paymentSubmissions: false,
    confirmedMemories: all.length,
    ownerMemories: all.filter((j) => j.tenant_id === OWNER_ID).length,
    providerJobsRechecked: statuses.length,
    allProviderCompleted: true,
    scenarios,
    citations,
    timeline: correction,
    freshRecall,
    reopened,
  };
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      scenarios: scenarios.map((s) => ({
        invoice: s.number,
        off: s.off.citations.length,
        on: s.on.citations.length,
        hold: !s.gate.allowed,
      })),
      confirmed: all.length,
      freshRecall: freshRecall.exactBlobRecalledAgain,
      reopened: reopened.length,
    }),
  );
} finally {
  await call('auth/logout', {}).catch(() => {});
  await client.dispose();
}
