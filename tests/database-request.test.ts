import { it, expect, vi, afterEach } from 'vitest';
const state = vi.hoisted(() => ({ pools: [] as { end: ReturnType<typeof vi.fn> }[] }));
vi.mock('@neondatabase/serverless', () => ({
  Pool: class {
    end = vi.fn(async () => {});
    on = vi.fn();
    constructor() {
      state.pools.push(this);
    }
  },
}));
vi.mock('drizzle-orm/neon-serverless', () => ({ drizzle: (pool: unknown) => ({ pool }) }));
import { db, withDatabaseRequest } from '@/db';
afterEach(() => {
  state.pools.length = 0;
  vi.unstubAllEnvs();
});
it('isolates simultaneous requests, reuses their transaction pool, and closes each once', async () => {
  vi.stubEnv('DATABASE_URL', 'fixture-never-connected');
  const values = await Promise.all(
    [1, 2].map(() =>
      withDatabaseRequest(async () => {
        const first = await db();
        await Promise.resolve();
        expect(await db()).toBe(first);
        await withDatabaseRequest(async () => expect(await db()).toBe(first));
        return first;
      }),
    ),
  );
  expect(values[0]).not.toBe(values[1]);
  expect(state.pools).toHaveLength(2);
  expect(state.pools.every((p) => p.end.mock.calls.length === 1)).toBe(true);
});
it('closes on error without replaying the operation and uses a fresh next request', async () => {
  vi.stubEnv('DATABASE_URL', 'fixture-never-connected');
  const operation = vi.fn(async () => {
    await db();
    throw Error('interrupted');
  });
  await expect(withDatabaseRequest(operation)).rejects.toThrow('interrupted');
  expect(operation).toHaveBeenCalledTimes(1);
  expect(state.pools[0].end).toHaveBeenCalledTimes(1);
  await withDatabaseRequest(async () => {
    await db();
  });
  expect(state.pools).toHaveLength(2);
});
it('gives deferred confirmation a fresh pool even when it inherits a completed request context', async () => {
  vi.stubEnv('DATABASE_URL', 'fixture-never-connected');
  let deferred!: () => Promise<unknown>;
  await withDatabaseRequest(async () => {
    const original = await db();
    deferred = () =>
      withDatabaseRequest(async () => {
        const independent = await db();
        expect(independent).not.toBe(original);
        return independent;
      }, true);
    await deferred();
    expect(await db()).toBe(original);
  });
  expect(state.pools).toHaveLength(2);
  expect(state.pools.every((pool) => pool.end.mock.calls.length === 1)).toBe(true);
});
