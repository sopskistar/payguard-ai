import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
async function main() {
  const { db } = await import('../src/db');
  if (process.env.DATABASE_URL && process.argv.includes('--http')) {
    // Explicit fallback for networks that block WebSockets. New migrations must be idempotent.
    const { neon } = await import('@neondatabase/serverless');
    const { drizzle } = await import('drizzle-orm/neon-http');
    const { migrate } = await import('drizzle-orm/neon-http/migrator');
    await migrate(drizzle(neon(process.env.DATABASE_URL)), { migrationsFolder: 'drizzle' });
  } else if (process.env.DATABASE_URL) {
    const { migrate } = await import('drizzle-orm/neon-serverless/migrator');
    await migrate((await db()) as never, { migrationsFolder: 'drizzle' });
  } else if (process.env.LOCAL_DATABASE_PATH && !process.env.VERCEL) {
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    await migrate(await db(), { migrationsFolder: 'drizzle' });
  } else
    throw new Error(
      'Set DATABASE_URL for Neon or explicitly set LOCAL_DATABASE_PATH for local QA.',
    );
  console.log('Migrations applied.');
  process.exit(0);
}
main().catch(() => {
  console.error(
    'Migration failed. Check database connectivity and migration permissions. Secrets are not logged.',
  );
  process.exit(1);
});
