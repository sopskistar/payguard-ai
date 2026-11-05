import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.useRealTimers());
it('serializes concurrent starts and spaces them by 500ms across callers', async () => {
  vi.useFakeTimers();
  vi.resetModules();
  const { pacedTatumRead } = await import('@/lib/integrations/tatum-read');
  const starts: number[] = [];
  let active = 0,
    peak = 0;
  const read = () =>
    pacedTatumRead(async () => {
      starts.push(Date.now());
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 100));
      active--;
      return starts.length;
    });
  const pending = Promise.all([read(), read(), read()]);
  await vi.runAllTimersAsync();
  await pending;
  expect(peak).toBe(1);
  expect(starts.slice(1).map((start, i) => start - starts[i])).toEqual([500, 500]);
});
it('does not retry transport or authentication errors and keeps the queue usable', async () => {
  vi.useFakeTimers();
  vi.resetModules();
  const { pacedTatumRead } = await import('@/lib/integrations/tatum-read');
  for (const code of ['UNAVAILABLE', 'UNAUTHENTICATED', 'NOT_FOUND']) {
    const op = vi.fn(async () => {
      throw Object.assign(Error('secret'), { code });
    });
    const pending = expect(pacedTatumRead(op)).rejects.toMatchObject({ code });
    await vi.runAllTimersAsync();
    await pending;
    expect(op).toHaveBeenCalledOnce();
  }
  const pending = pacedTatumRead(async () => 'still usable');
  await vi.runAllTimersAsync();
  expect(await pending).toBe('still usable');
});
