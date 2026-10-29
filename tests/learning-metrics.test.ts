import { expect, it } from 'vitest';
import { learningMetrics, type LearningCase } from '@/lib/learning-metrics';
const base: LearningCase = {
  correct: true,
  expectedApprovalAllowed: false,
  actualApprovalAllowed: false,
  returned: 3,
  applied: 1,
  baselinePreserved: true,
  control: false,
  addedCritical: 0,
  staleApplied: 0,
  wrongScopeApplied: 0,
};
it('counts missed holds and false holds separately from retrieval applicability', () => {
  const result = learningMetrics(
    [
      base,
      { ...base, expectedApprovalAllowed: true, correct: false, control: true, addedCritical: 1 },
      { ...base, actualApprovalAllowed: true, correct: false },
    ],
    [{ returned: 3 }, { returned: 0 }],
  );
  expect(result).toMatchObject({
    cases: 3,
    correct: 1,
    failed: 2,
    expectedHolds: 2,
    expectedAllowed: 1,
    falseApprovalHolds: 1,
    missedApprovalHolds: 1,
    appliedCandidateCasePairs: 3,
    unappliedCandidateCasePairs: 6,
    successfulRecalls: 1,
    recallQueries: 2,
    controlsWithAddedCritical: 1,
  });
  expect(result.applicableCitationFraction).toBeCloseTo(1 / 3);
});
it('does not invent recall scores when there are no candidates or cases', () => {
  expect(learningMetrics([], [])).toMatchObject({
    cases: 0,
    successfulRecalls: 0,
    applicableCitationFraction: 0,
  });
});
