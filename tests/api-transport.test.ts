import { it, expect, vi, afterEach } from 'vitest';
import { api } from '@/components/ui';
afterEach(() => vi.unstubAllGlobals());
it('retries one transient read failure and returns only a real successful response', async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new TypeError('network reset'))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  vi.stubGlobal('fetch', fetcher);
  expect(await api('snapshot')).toEqual({ ok: true });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('does not retry HTTP failures or falsely report success', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ error: 'Unavailable' }), { status: 503 }));
  vi.stubGlobal('fetch', fetcher);
  await expect(api('snapshot')).rejects.toThrow('Unavailable');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('never automatically retries a failed mutation', async () => {
  const fetcher = vi.fn().mockRejectedValue(new TypeError('network reset'));
  vi.stubGlobal('fetch', fetcher);
  await expect(api('corrections', { consent: true })).rejects.toThrow('network reset');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
