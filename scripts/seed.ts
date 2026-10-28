import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
async function main() {
  const { seedDemo } = await import('../src/lib/store');
  await seedDemo();
  console.log(
    'Eight sample invoices seeded idempotently. No blockchain payments or memories were fabricated.',
  );
  process.exit(0);
}
main().catch(() => {
  console.error('Seed failed. Apply migrations and check database configuration.');
  process.exit(1);
});
