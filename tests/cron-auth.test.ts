import { afterEach, expect, it, vi } from 'vitest';
import { requireCronAuthorization } from '@/lib/cron-auth';
afterEach(() => vi.unstubAllEnvs());
it('fails closed on absent, short or incorrect scheduler authorization', () => {
  vi.stubEnv('CRON_SECRET', '');
  expect(() =>
    requireCronAuthorization(new Request('http://localhost/api/service-reconciliation')),
  ).toThrow('configuration');
  vi.stubEnv('CRON_SECRET', 'fixture-only-cron-credential-0000000000000000');
  for (const value of ['', 'Bearer incorrect', 'fixture-only-cron-credential-0000000000000000'])
    expect(() =>
      requireCronAuthorization(
        new Request('http://localhost/api/service-reconciliation', {
          headers: { authorization: value },
        }),
      ),
    ).toThrow('authorization');
  expect(() =>
    requireCronAuthorization(
      new Request('http://localhost/api/service-reconciliation', {
        headers: { authorization: 'Bearer fixture-only-cron-credential-0000000000000000' },
      }),
    ),
  ).not.toThrow();
});
