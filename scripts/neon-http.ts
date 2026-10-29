// Optional script-only adapter for runners where Neon WebSockets are unavailable.
// Do not use for business transactions or change the application's transaction-capable runtime.
export async function initializeScriptHttpDatabase() {
  if (!process.argv.includes('--http')) return;
  if (!process.env.DATABASE_URL || process.env.VERCEL)
    throw new Error('Script-only Neon HTTP configuration unavailable');
  const { neon } = await import('@neondatabase/serverless');
  const { drizzle } = await import('drizzle-orm/neon-http');
  const schema = await import('../src/db/schema');
  (globalThis as { payguardDb?: unknown }).payguardDb = drizzle(neon(process.env.DATABASE_URL), {
    schema,
  });
}
