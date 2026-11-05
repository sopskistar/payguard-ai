import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateBusinessBatch } from '@/lib/business-memory-batch';
const original = JSON.parse(
  readFileSync('docs/evidence/business-memory-proposed-batch.json', 'utf8'),
);
const expected = {
  account: original.destinationAccount,
  namespace: original.namespace,
  tenant: original.records[0].tenantId,
};
function changed(fn: (b: typeof original) => void) {
  const b = structuredClone(original);
  fn(b);
  const { sha256, ...payload } = b;
  void sha256;
  b.sha256 = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return b;
}
it('accepts only the reviewed exact 17-record synthetic manifest with zero paid operations', () => {
  expect(validateBusinessBatch(original, original.sha256, expected).records).toHaveLength(17);
});
it('requires explicit exact-digest approval and detects altered text', () => {
  expect(() => validateBusinessBatch(original, '', expected)).toThrow('BATCH_NOT_APPROVED');
  const b = structuredClone(original);
  b.records[0].exactText += ' altered';
  expect(() => validateBusinessBatch(b, original.sha256, expected)).toThrow('BATCH_CHANGED');
});
it('refuses a larger or paid batch even with a new approval digest', () => {
  for (const alter of [
    (b: typeof original) => {
      b.maxNewWrites = 18;
    },
    (b: typeof original) => {
      b.cost.maximumPaidOperations = 1;
    },
  ]) {
    const b = changed(alter);
    expect(() => validateBusinessBatch(b, b.sha256, expected)).toThrow('BATCH_SCOPE');
  }
});
it('refuses foreign ownership, namespace changes and non-synthetic or hard policies', () => {
  for (const alter of [
    (b: typeof original) => {
      b.records[0].tenantId = 'different';
    },
    (b: typeof original) => {
      b.records[0].namespace = 'different';
    },
    (b: typeof original) => {
      b.records[0].policy.isDemo = false;
    },
    (b: typeof original) => {
      b.records[0].policy.hard = true;
    },
  ]) {
    const b = changed(alter);
    expect(() => validateBusinessBatch(b, b.sha256, expected)).toThrow('BATCH_RECORD_CONFLICT');
  }
});
it('refuses repeated scenarios and duplicate exact content', () => {
  const b = changed((b) => {
    b.records[1] = b.records[0];
  });
  expect(() => validateBusinessBatch(b, b.sha256, expected)).toThrow('BATCH_DUPLICATE');
});
