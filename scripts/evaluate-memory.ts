import { config } from 'dotenv';
import { writeFile } from 'node:fs/promises';
config({ path: '.env.local', quiet: true });
async function main() {
  const { OWNER_ID } = await import('../src/lib/demo');
  const { listInvoices, policies, preferences } = await import('../src/lib/store');
  const { recallMemories, vendorReference } = await import('../src/lib/integrations/memory');
  const { evaluate } = await import('../src/lib/risk');
  const all = await listInvoices(OWNER_ID);
  const rules = await policies(OWNER_ID);
  const prefs = await preferences(OWNER_ID);
  const results = [];
  for (const name of ['Northstar Studio', 'Orbit Hosting', 'Forma Legal', 'Lumen Research']) {
    const source = all.find((i) => i.isDemo && i.vendor === name)!;
    const recall = await recallMemories(
      OWNER_ID,
      `Policies for ${vendorReference(OWNER_ID, source.vendorId)}: changed recipients, recurring billing corrections, current approval thresholds and narrowly verified exceptions.`,
      source.id,
    );
    const off = evaluate(source, all, prefs, rules, [], 'Off');
    const on = evaluate(source, all, prefs, rules, recall.citations, recall.status);
    const applied = on.citations.map((c) => rules.find((p) => p.id === c.policyId)!);
    const staleApplied = applied.filter(
      (p) => !p.active || p.supersededBy || (p.expiresAt && Date.parse(p.expiresAt) <= Date.now()),
    ).length;
    results.push({
      vendor: name,
      scenario: 'Synthetic business review',
      returned: recall.citations.length,
      applied: applied.length,
      staleApplied,
      wrongScopeApplied: applied.filter(
        (p) => p.scope === 'vendor' && p.vendorId !== source.vendorId,
      ).length,
      off: off.level,
      on: on.level,
      citations: on.citations.map((c) => ({ id: c.id, blobId: c.blobId, policyId: c.policyId })),
      baselineFindingsPreserved: off.findings.every((f) => on.findings.some((g) => g.id === f.id)),
    });
  }
  const source = all.find((i) => i.isDemo && i.number === 'NS-1048')!;
  const approved = all.find(
    (i) => i.isDemo && i.vendorId === source.vendorId && i.status === 'approved',
  );
  const control = {
    ...source,
    id: 'quality-control',
    number: 'QUALITY-CONTROL',
    recipient: approved?.recipient || source.recipient,
    amount: '100',
    tokenAmount: '1',
    memo: 'Synthetic routine unchanged invoice',
    due: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  };
  const r = await recallMemories(
    OWNER_ID,
    `Routine unchanged recipient invoice for ${vendorReference(OWNER_ID, source.vendorId)}; check applicable approved policy context.`,
    source.id,
  );
  const controlOff = evaluate(control, all, prefs, rules, [], 'Off');
  const controlOn = evaluate(control, all, prefs, rules, r.citations, r.status);
  const metrics = {
    checkedAt: new Date().toISOString(),
    source: 'Fresh process, real SDK semantic recalls; synthetic invoices; no fabricated retrieval',
    results,
    control: {
      baselineCritical: controlOff.findings.filter((f) => f.severity === 'critical').length,
      learnedCritical: controlOn.findings.filter((f) => f.severity === 'critical').length,
      extraCritical: controlOn.findings.filter(
        (f) => f.severity === 'critical' && !controlOff.findings.some((g) => g.id === f.id),
      ).length,
    },
    staleOrWrongScopeApplied: results.reduce((n, r) => n + r.staleApplied + r.wrongScopeApplied, 0),
    baselinePreservationRate:
      results.filter((r) => r.baselineFindingsPreserved).length / results.length,
    reviewRecallSuccessRate: results.filter((r) => r.applied > 0).length / results.length,
  };
  await writeFile('docs/evidence/memory-quality.json', JSON.stringify(metrics, null, 2) + '\n');
  console.log(JSON.stringify(metrics, null, 2));
  process.exit(
    metrics.staleOrWrongScopeApplied === 0 && metrics.baselinePreservationRate === 1 ? 0 : 2,
  );
}
main().catch(() => {
  console.error('Live quality evaluation unavailable; no success claimed.');
  process.exit(1);
});
