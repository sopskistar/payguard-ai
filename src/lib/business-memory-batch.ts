import { createHash } from 'node:crypto';
import { businessLearningScenarios } from './business-learning-scenarios';
import type { Policy } from './types';
export type BusinessMemoryBatch = {
  sha256: string;
  version: number;
  batchId: string;
  destinationAccount: string;
  destinationOwner: string;
  canonicalChainIdentifier: string;
  namespace: string;
  startingDistinctConfirmed: number;
  targetDistinctConfirmed: number;
  maxNewWrites: number;
  cost: { maximumPaidOperations: number };
  records: {
    scenarioId: string;
    syntheticSupplier: string;
    tenantId: string;
    namespace: string;
    accountId: string;
    vendorId: string;
    invoiceId: string;
    policyId: string;
    operationKey: string;
    policy: Policy;
    syntheticFixture: {
      number: string;
      issued: string;
      due: string;
      amount: string;
      currency: string;
      recipient: string;
      memo: string;
      isDemo: boolean;
    };
    exactText: string;
    sha256: string;
  }[];
};
export function validateBusinessBatch(
  input: unknown,
  approvedSha: string,
  expected: { account: string; tenant: string; namespace: string },
): BusinessMemoryBatch {
  const batch = input as BusinessMemoryBatch;
  if (!batch || !/^[a-f0-9]{64}$/.test(approvedSha) || batch.sha256 !== approvedSha)
    throw Error('BATCH_NOT_APPROVED');
  const { sha256, ...payload } = batch;
  if (createHash('sha256').update(JSON.stringify(payload)).digest('hex') !== sha256)
    throw Error('BATCH_CHANGED');
  if (
    batch.version !== 1 ||
    batch.batchId !== 'payguard-business-v2-2026-11-05' ||
    batch.destinationAccount !== expected.account ||
    batch.namespace !== expected.namespace ||
    batch.startingDistinctConfirmed !== 33 ||
    batch.targetDistinctConfirmed !== 50 ||
    batch.maxNewWrites !== 17 ||
    batch.cost.maximumPaidOperations !== 0 ||
    batch.records.length !== 17
  )
    throw Error('BATCH_SCOPE');
  if (
    new Set(batch.records.map((r) => r.scenarioId)).size !== 17 ||
    new Set(batch.records.map((r) => r.operationKey)).size !== 17 ||
    new Set(batch.records.map((r) => r.exactText)).size !== 17
  )
    throw Error('BATCH_DUPLICATE');
  for (const row of batch.records) {
    const scenario = businessLearningScenarios.find((s) => s.id === row.scenarioId);
    if (
      !scenario ||
      row.tenantId !== expected.tenant ||
      row.accountId !== expected.account ||
      row.namespace !== expected.namespace ||
      row.operationKey !== 'business-v2-' + scenario.id ||
      row.policy.id !== row.policyId ||
      row.policy.vendorId !== row.vendorId ||
      row.policy.isDemo !== true ||
      row.policy.hard !== false ||
      row.policy.kind !== scenario.kind ||
      row.policy.active !== scenario.active ||
      row.policy.scope !== scenario.scope ||
      row.policy.expiresAt !== scenario.expiresAt ||
      !row.syntheticFixture.isDemo ||
      row.syntheticFixture.recipient !== 'bank:SYNTHETIC-' + scenario.id ||
      row.sha256 !== createHash('sha256').update(row.exactText).digest('hex') ||
      !row.exactText.includes(scenario.content) ||
      !row.exactText.includes('Synthetic business event.')
    )
      throw Error('BATCH_RECORD_CONFLICT');
  }
  return batch;
}
