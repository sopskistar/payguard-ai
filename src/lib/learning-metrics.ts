export type LearningCase = {
  correct: boolean;
  expectedApprovalAllowed: boolean;
  actualApprovalAllowed: boolean;
  returned: number;
  applied: number;
  baselinePreserved: boolean;
  control: boolean;
  addedCritical: number;
  staleApplied: number;
  wrongScopeApplied: number;
  [key: string]: unknown;
};
export function learningMetrics(rows: LearningCase[], recalls: { returned: unknown }[]) {
  const sum = (key: 'returned' | 'applied' | 'staleApplied' | 'wrongScopeApplied') =>
    rows.reduce((n, row) => n + row[key], 0);
  const expectedHolds = rows.filter((r) => !r.expectedApprovalAllowed);
  const allowed = rows.filter((r) => r.expectedApprovalAllowed);
  const controls = rows.filter((r) => r.control);
  const correct = rows.filter((r) => r.correct).length;
  return {
    cases: rows.length,
    correct,
    failed: rows.length - correct,
    baselinePreserved: rows.filter((r) => r.baselinePreserved).length,
    recallQueries: recalls.length,
    successfulRecalls: recalls.filter((r) => Number(r.returned) > 0).length,
    scenariosWithAppliedMemory: rows.filter((r) => r.applied > 0).length,
    controls: controls.length,
    controlsWithAddedCritical: controls.filter((r) => r.addedCritical > 0).length,
    staleOrWrongScopeApplied: sum('staleApplied') + sum('wrongScopeApplied'),
    applicableCitationFraction: sum('returned') ? sum('applied') / sum('returned') : 0,
    expectedHolds: expectedHolds.length,
    expectedAllowed: allowed.length,
    falseApprovalHolds: allowed.filter((r) => !r.actualApprovalAllowed).length,
    missedApprovalHolds: expectedHolds.filter((r) => r.actualApprovalAllowed).length,
    appliedCandidateCasePairs: sum('applied'),
    unappliedCandidateCasePairs: sum('returned') - sum('applied'),
  };
}
