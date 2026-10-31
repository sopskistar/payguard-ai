import { expect, it } from 'vitest';
import { serviceDiagnostic } from '@/lib/service-diagnostics';
it('retains actionable provider codes and reasons without signature or credential disclosure', () => {
  const d = serviceDiagnostic(
    'tentacle.verify',
    {
      code: 'INVALID_SIGNATURE',
      invalidReason: 'Unsupported sponsored transaction; token private-test-key ' + 'A'.repeat(180),
    },
    ['private-test-key'],
  );
  expect(d.code).toBe('INVALID_SIGNATURE');
  expect(d.message).toContain('Unsupported sponsored transaction');
  expect(d.message).not.toContain('private-test-key');
  expect(d.message).not.toContain('A'.repeat(80));
  expect(d.checkedAt).toMatch(/^\d{4}-/);
});
it('shows wallet refusal and never serializes arbitrary provider objects', () => {
  expect(
    serviceDiagnostic('wallet', { code: 4001, message: 'User rejected the transaction.' }).message,
  ).toBe('User rejected the transaction.');
  expect(
    serviceDiagnostic('wallet', { signature: 'private', data: { secret: 'private' } }).message,
  ).not.toContain('private');
});
