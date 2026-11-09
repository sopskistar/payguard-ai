import 'server-only';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless';
import type { Pool } from '@neondatabase/serverless';
import { RecoveringNeonPool } from './neon-pool';
import { AsyncLocalStorage } from 'node:async_hooks';
import { drizzle as localDrizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import * as schema from './schema';
export type Database = PgliteDatabase<typeof schema>;
const globalDb = globalThis as unknown as { payguardDb?: Database };
const requests = new AsyncLocalStorage<{ database?: Database; pool?: Pool }>();

// A Neon WebSocket pool belongs to one request. All operations and interactive
// transactions within that request reuse it; another request gets its own pool.
export async function withDatabaseRequest<T>(
  operation: () => Promise<T>,
  fresh = false,
): Promise<T> {
  if (!process.env.DATABASE_URL || (!fresh && requests.getStore())) return operation();
  return requests.run({}, async () => {
    try {
      return await operation();
    } finally {
      await requests
        .getStore()
        ?.pool?.end()
        .catch(() => {});
    }
  });
}
function neonDatabase() {
  const pool = new RecoveringNeonPool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 12000,
    idleTimeoutMillis: 20000,
    max: 5,
  });
  // The pool removes an idle errored client. Do not print driver messages/parameters.
  pool.on('error', () =>
    console.error('Neon idle connection closed; a new request uses a new pool.'),
  );
  return { pool, database: neonDrizzle(pool, { schema }) as unknown as Database };
}
export function storageKind() {
  return process.env.DATABASE_URL
    ? 'Neon Postgres'
    : process.env.LOCAL_DATABASE_PATH && !process.env.VERCEL
      ? 'Local PostgreSQL QA (not Neon)'
      : 'Not configured';
}
export function databaseConfigured() {
  return storageKind() !== 'Not configured';
}
export async function db(): Promise<Database> {
  const request = requests.getStore();
  if (request) {
    if (!request.database) Object.assign(request, neonDatabase());
    return request.database!;
  }
  if (globalDb.payguardDb) return globalDb.payguardDb;
  if (process.env.DATABASE_URL) {
    globalDb.payguardDb = neonDatabase().database;
  } else if (process.env.LOCAL_DATABASE_PATH && !process.env.VERCEL) {
    const { PGlite } = await import('@electric-sql/pglite');
    globalDb.payguardDb = localDrizzle(new PGlite(process.env.LOCAL_DATABASE_PATH), { schema });
  } else {
    throw new Error('DATABASE_NOT_CONFIGURED');
  }
  return globalDb.payguardDb;
}
