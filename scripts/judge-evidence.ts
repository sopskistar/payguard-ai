import { config } from 'dotenv';
import { writeFile } from 'node:fs/promises';
config({ path: '.env.local', quiet: true });
async function main() {
  const { OWNER_ID, demoInvoices } = await import('../src/lib/demo');
  const { listInvoices, policies } = await import('../src/lib/store');
  const { assess } = await import('../src/lib/integrations/memory');
  const invoice = (await listInvoices(OWNER_ID)).find((i) => i.isDemo && i.number === 'NS-1048');
  if (!invoice) throw new Error('Synthetic source missing');
  const off = await assess(OWNER_ID, invoice.id, false);
  const on = await assess(OWNER_ID, invoice.id, true);
  if (!on.citations.length)
    throw new Error('No actual recalled citations; preserve previous public artifact');
  const allowed = new Set(on.citations.map((c) => c.policyId));
  const fixture = demoInvoices()[0];
  const rules = (await policies(OWNER_ID))
    .filter((p) => allowed.has(p.id) && p.isDemo === true && p.vendorId === invoice.vendorId)
    .map((p) => ({
      ...p,
      vendorId: fixture.vendorId,
      invoiceId: p.scope === 'invoice' ? fixture.id : null,
    }));
  const report = {
    capturedAt: new Date().toISOString(),
    source:
      'Actual authenticated Walrus semantic recall; recorded public replay, not a live guest query',
    syntheticBusinessData: true,
    vendorMapping:
      'Synthetic Neon vendor mapped to bundled Northstar fixture for deterministic replay',
    policies: rules,
    citations: on.citations.filter((c) => rules.some((p) => p.id === c.policyId)),
    off,
    on,
  };
  await writeFile('docs/evidence/judge-recall.json', JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      capturedAt: report.capturedAt,
      applicableCitations: report.citations.length,
      off: off.level,
      on: on.level,
    }),
  );
  process.exit(0);
}
main().catch(() => {
  console.error('Judge evidence capture unavailable. Existing evidence preserved.');
  process.exit(1);
});
