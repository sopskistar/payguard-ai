import { expect, it } from 'vitest';
import evidence from '../docs/evidence/courtroom.json';
import payments from '../docs/evidence/mainnet-service-reconciliation.json';
import recall from '../docs/evidence/judge-recall.json';
import { judgeReview } from '@/lib/judge';
import type { Policy } from '@/lib/types';
it('publishes only captured synthetic reviews with retained baseline holds and owned provenance', () => {
  expect(evidence.scenarios).toHaveLength(3);
  expect(evidence.providerJobsRechecked).toBe(evidence.confirmedMemories);
  expect(evidence.allProviderCompleted).toBe(true);
  for (const s of evidence.scenarios) {
    expect(s.off.citations).toHaveLength(0);
    expect(s.on.citations.length).toBeGreaterThan(0);
    expect(s.gate.allowed).toBe(false);
    expect(s.off.findings.every((f) => s.on.findings.some((g) => g.id === f.id))).toBe(true);
    expect(
      s.on.citations.every((c) =>
        evidence.citations.some((j) => j.id === c.id && j.blob_id === c.blobId && j.is_demo),
      ),
    ).toBe(true);
  }
  expect(evidence.freshRecall.exactBlobRecalledAgain).toBe(true);
  expect(evidence.reopened.every((r) => r.sameReceipt)).toBe(true);
  expect(new Set(evidence.citations.map((c) => c.namespace)).size).toBe(1);
});
it('uses the real existing attack engine and never lets a retrieved policy release the human gate', () => {
  for (const memory of [false, true]) {
    const r = judgeReview(memory, recall.policies as Policy[], recall.citations, undefined, true);
    expect(r.gate.allowed).toBe(false);
    expect(
      r.assessment.findings.some((f) => f.id === 'invoice-directive' && f.severity === 'critical'),
    ).toBe(true);
  }
});
it('binds all three real payment receipts to distinct invoices and exact accounting', () => {
  expect(payments.payments).toHaveLength(3);
  expect(new Set(payments.payments.map((p) => p.quoteId)).size).toBe(3);
  expect(
    payments.payments.every(
      (p) =>
        p.finalized &&
        p.merchantCreditAtomic === '1000000' &&
        p.payerGasAtomic === '0' &&
        p.exactApprovedBytesExecuted &&
        p.settlementRequests === 1,
    ),
  ).toBe(true);
  expect(payments.settledTotalAtomic).toBe('3000000');
});
