import { it, expect } from 'vitest';
import { judgeReview, JUDGE_HASH } from '@/lib/judge';
import evidence from '../docs/evidence/judge-recall.json';
import type { Policy, HumanVerification } from '@/lib/types';
it('public replay uses actual captured citations, retaining the independent hold in both modes', () => {
  const off = judgeReview(false, evidence.policies as Policy[], evidence.citations);
  const on = judgeReview(true, evidence.policies as Policy[], evidence.citations);
  expect(off.gate.allowed).toBe(false);
  expect(on.gate.allowed).toBe(false);
  expect(off.assessment.citations).toHaveLength(0);
  expect(on.assessment.citations.length).toBeGreaterThan(0);
  expect(on.assessment.findings.some((f) => f.memoryId)).toBe(true);
});
it('binds the synthetic attestation to exact instructions and invalidates edited directives', () => {
  const source = judgeReview(false, [], []);
  const human: HumanVerification = {
    id: 'practice',
    invoiceId: source.invoice.id,
    recipient: source.invoice.recipient,
    profileRevision: 1,
    instructionHash: JUDGE_HASH,
    outcome: 'confirmed',
    method: 'phone',
    note: 'Synthetic practice only',
    checkedAt: new Date().toISOString(),
  };
  expect(judgeReview(false, [], [], human).gate.allowed).toBe(true);
  expect(judgeReview(false, [], [], human, true).gate.allowed).toBe(false);
  expect(
    judgeReview(false, [], [], { ...human, checkedAt: '2025-01-01T00:00:00Z' }).gate.allowed,
  ).toBe(false);
});
