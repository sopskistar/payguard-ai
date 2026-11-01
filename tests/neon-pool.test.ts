import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ acquire: vi.fn(), query: vi.fn(), release: vi.fn() }));
vi.mock('@neondatabase/serverless', () => ({
  Pool: class {
    ending = false;
    connect(callback?: (error: unknown, client?: unknown, release?: unknown) => void) {
      const pending = state.acquire();
      if (!callback) return pending;
      void pending.then((client: unknown) => callback(undefined, client, state.release), callback);
    }
    query(text: string) {
      // Model the driver's callback acquisition path: dispatch SQL only after acquisition.
      return new Promise((resolve, reject) =>
        this.connect((error, client) => {
          if (error) return reject(error);
          (client as { query: (text: string) => Promise<unknown> })
            .query(text)
            .then(resolve, reject)
            .finally(state.release);
        }),
      );
    }
  },
}));
import { RecoveringNeonPool } from '@/db/neon-pool';
afterEach(() => vi.resetAllMocks());
function setup() {
  const client = { query: state.query, release: state.release };
  state.acquire.mockResolvedValue(client);
  state.query.mockResolvedValue({ rows: [{ connected: 1 }] });
  return { client, pool: new RecoveringNeonPool() };
}
it('retries a failed handshake once before dispatching application SQL exactly once', async () => {
  const { pool } = setup();
  state.acquire.mockRejectedValueOnce({ type: 'error', error: { code: 'ETIMEDOUT' } });
  await expect(pool.query('SELECT 1')).resolves.toEqual({ rows: [{ connected: 1 }] });
  expect(state.acquire).toHaveBeenCalledTimes(2);
  expect(state.query).toHaveBeenCalledTimes(1);
});
it('supports transaction promise acquisition without replaying its callback', async () => {
  const { pool, client } = setup();
  state.acquire.mockRejectedValueOnce({ code: 'ECONNRESET' });
  expect(await pool.connect()).toBe(client);
  expect(state.acquire).toHaveBeenCalledTimes(2);
  expect(state.query).not.toHaveBeenCalled();
});
it('never retries a query or uncertain COMMIT after the client was acquired', async () => {
  const { pool } = setup();
  state.query.mockRejectedValueOnce(Object.assign(Error('response lost'), { code: 'ECONNRESET' }));
  await expect(pool.query('COMMIT')).rejects.toMatchObject({ code: 'ECONNRESET' });
  expect(state.acquire).toHaveBeenCalledTimes(1);
  expect(state.query).toHaveBeenCalledTimes(1);
});
it('bounds persistent connection failure without sending SQL', async () => {
  const { pool } = setup();
  state.acquire.mockRejectedValue({ type: 'error' });
  await expect(pool.query('INSERT INTO financial_reservations VALUES (1)')).rejects.toMatchObject({
    name: 'DatabaseError',
  });
  expect(state.acquire).toHaveBeenCalledTimes(2);
  expect(state.query).not.toHaveBeenCalled();
});
it.each(['28P01', '53300', '42501'])(
  'does not retry credential, capacity or permission failure %s',
  async (code) => {
    const { pool } = setup();
    state.acquire.mockRejectedValue({ code });
    await expect(pool.connect()).rejects.toMatchObject({ name: 'DatabaseError', cause: { code } });
    expect(state.acquire).toHaveBeenCalledTimes(1);
  },
);
