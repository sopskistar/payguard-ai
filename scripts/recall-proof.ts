import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
config({ path: '.env.local', quiet: true });
let phase = 'start';
async function main() {
  const { OWNER_ID } = await import('../src/lib/demo');
  const { listInvoices, saveInvoice } = await import('../src/lib/store');
  const { assess } = await import('../src/lib/integrations/memory');
  phase = 'load invoices';
  const source = (await listInvoices(OWNER_ID)).find((i) => i.isDemo && i.number === 'NS-1048');
  if (!source) throw new Error('Seed samples first');
  phase = 'create later invoice';
  const invoiceId = await saveInvoice(OWNER_ID, {
    ...source,
    number: 'NS-cross-session-' + Date.now(),
    importKey: randomUUID(),
    source: 'manual',
  });
  phase = 'baseline assessment';
  const off = await assess(OWNER_ID, invoiceId, false);
  phase = 'live recall assessment';
  const on = await assess(OWNER_ID, invoiceId, true);
  const proof = {
    checkedAt: new Date().toISOString(),
    source:
      'New server process, persistent Neon and live Walrus recall (browser-session gate is separate)',
    invoiceId,
    syntheticInvoice: true,
    off: {
      level: off.level,
      memoryStatus: off.memoryStatus,
      findings: off.findings.map((f) => ({ id: f.id, memoryId: f.memoryId })),
    },
    on: {
      level: on.level,
      memoryStatus: on.memoryStatus,
      findings: on.findings.map((f) => ({ id: f.id, memoryId: f.memoryId })),
      citations: on.citations.map((c) => ({ id: c.id, blobId: c.blobId, policyId: c.policyId })),
    },
  };
  await mkdir('.data', { recursive: true });
  await writeFile('.data/recall-proof.json', JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify(proof, null, 2));
  process.exit(on.citations.length && on.findings.some((f) => f.memoryId) ? 0 : 2);
}
main().catch(async (error) => {
  const { safeError } = await import('../src/lib/errors');
  let cause: unknown = error;
  const codes = [];
  for (let depth = 0; cause && depth < 4; depth++) {
    const e = cause as { name?: string; code?: string; cause?: unknown };
    codes.push({ name: e.name, code: e.code });
    cause = e.cause;
  }
  console.error(JSON.stringify({ phase, diagnostics: codes, message: safeError(error) }));
  process.exit(1);
});
