import { config } from 'dotenv';
import { writeFile } from 'node:fs/promises';
config({ path: '.env.local', quiet: true });
try {
  const origin = process.argv.find((a) => a.startsWith('--origin='))?.slice(9);
  if (origin) process.env.APP_URL = new URL(origin).origin;
  const { servicePreflight } = await import('../src/lib/service-payments');
  const result = await servicePreflight();
  await writeFile('.data/mainnet-payment-proposal.json', JSON.stringify(result, null, 2) + '\n');
  const { payer, recipient, ...sanitized } = result;
  const publicReport = {
    execution: 'Local operator read-only preflight; not production wallet clearance',
    ...sanitized,
    payerConfigured: !!payer,
    recipientConfigured: !!recipient,
    noFinancialApprovalGranted: true,
    settlementAttempted: false,
  };
  if (process.argv.includes('--publish'))
    await writeFile(
      'docs/evidence/mainnet-service-preflight.json',
      JSON.stringify(publicReport, null, 2) + '\n',
    );
  console.log(JSON.stringify(publicReport, null, 2));
} catch {
  console.error(
    'Non-spending payment preflight failed; no success or settlement assumed. Check TATUM_API_KEY and provider availability.',
  );
  process.exitCode = 1;
}
