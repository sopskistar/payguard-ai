import 'server-only';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import { drizzle as localDrizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import * as schema from './schema';
export type Database = PgliteDatabase<typeof schema>;
const globalDb = globalThis as unknown as { payguardDb?: Database };
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
  if (globalDb.payguardDb) return globalDb.payguardDb;
  if (process.env.DATABASE_URL) {
    globalDb.payguardDb = neonDrizzle(
      new Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 12000,
        idleTimeoutMillis: 20000,
        max: 5,
      }),
      { schema },
    ) as unknown as Database;
  } else if (process.env.LOCAL_DATABASE_PATH && !process.env.VERCEL) {
    const { PGlite } = await import('@electric-sql/pglite');
    globalDb.payguardDb = localDrizzle(new PGlite(process.env.LOCAL_DATABASE_PATH), { schema });
  } else {
    throw new Error('DATABASE_NOT_CONFIGURED');
  }
  return globalDb.payguardDb;
}
