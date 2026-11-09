import { afterEach, expect, it, vi } from 'vitest';
const worker = vi.hoisted(() => vi.fn());
vi.mock('@/db', () => ({
  withDatabaseRequest: (operation: () => Promise<unknown>) => operation(),
}));
vi.mock('@/lib/service-reconciliation', () => ({ reconcilePendingServicePayments: worker }));
import { GET } from '@/app/api/service-reconciliation/route';
afterEach(() => {
  vi.unstubAllEnvs();
  worker.mockReset();
});
it('requires the scheduler secret before touching any payment and returns only bounded counts', async () => {
  vi.stubEnv('CRON_SECRET', 'fixture-only-cron-credential-0000000000000000');
  expect((await GET(new Request('http://localhost/api/service-reconciliation'))).status).toBe(401);
  expect(worker).not.toHaveBeenCalled();
  worker.mockResolvedValue({ settled: 1, pending: 0, held: 0, maximumPerRun: 3, submissions: 0 });
  const r = await GET(
    new Request('http://localhost/api/service-reconciliation', {
      headers: { authorization: 'Bearer fixture-only-cron-credential-0000000000000000' },
    }),
  );
  expect(r.status).toBe(200);
  expect(r.headers.get('cache-control')).toBe('private, no-store');
  expect(await r.json()).toMatchObject({ settled: 1, submissions: 0, maximumPerRun: 3 });
  expect(worker).toHaveBeenCalledTimes(1);
});
