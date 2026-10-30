// Read-only. Prefer the immutable attempt snapshot once signing was unlocked.
import { readFile } from 'node:fs/promises';
import { reconcileConversion } from './reconcile';
const dir = '.data/sui-self-deposit';
let file = `${dir}/attempt-preview.json`;
try {
  await readFile(file);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  file = `${dir}/preview.json`;
}
const p = JSON.parse(await readFile(file, 'utf8'));
const parties = JSON.parse(await readFile('.data/production-payment-parties.json', 'utf8'));
const digest = process.argv[2];
if (
  !digest ||
  digest !== p.unsignedDigest ||
  p.plan.payer !== parties.payer ||
  parties.payer === parties.recipient
)
  throw new Error(
    'Actual digest and Wallet A must match the frozen attempt. No transaction will be sent.',
  );
const result = await reconcileConversion(p, dir);
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.status === 'confirmed' ? 0 : 2;
