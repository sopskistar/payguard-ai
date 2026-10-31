import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { parse } from 'dotenv';
import { localOwnerConfig, LocalOwnerError } from './config';
import { AppError } from '../../src/lib/errors';

try {
  const args = process.argv.slice(2);
  if (args.some((a) => a !== '--enable-settlement'))
    throw new LocalOwnerError(
      'Supported option: --enable-settlement. No arbitrary host or port is accepted.',
    );
  const source = { ...parse(await readFile('.env.local', 'utf8')), ...process.env };
  const parties = await readFile('.data/owner-payment-config.json', 'utf8')
    .then(JSON.parse)
    .catch(() => ({}));
  const env = localOwnerConfig(source, parties, args.includes('--enable-settlement'));
  Object.assign(process.env, env);
  await readFile('.next/BUILD_ID');
  const { servicePreflight } = await import('../../src/lib/service-payments');
  const check = await servicePreflight();
  if (!check.readyForQuotePreparation)
    throw new LocalOwnerError(
      'Genuine provider checks or usable funds are not ready. No server with live capability was started.',
    );
  console.log('PayGuard owner-local workspace: http://localhost:4320/services');
  console.log(
    'Existing Neon records; no migration, reset, seed, memory write or automatic payment.',
  );
  console.log(
    `Mainnet quotes enabled. Settlement capability: ${env.SERVICE_PAYMENT_SETTLEMENT_ENABLED === 'true' ? 'enabled ONLY after exact authenticated owner approval and wallet signature' : 'disabled; use --enable-settlement only for a supervised purchase'}.`,
  );
  console.log(
    'Use Owner Sign In with your existing private password. Never enter keys or recovery phrases.',
  );
  console.log(
    'This does not clear the Slush Production warning. Stop if the wallet rejects localhost.',
  );
  const child = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '4320'],
    { env, stdio: 'inherit' },
  );
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.once(signal, () => child.kill(signal));
  child.on('error', () => {
    console.error('Local server could not start. No payment was requested.');
    process.exitCode = 1;
  });
  child.on('exit', (code) => {
    process.exitCode = code ?? 1;
  });
} catch (error) {
  // Never print provider bodies, credentials or environment values.
  console.error(
    error instanceof LocalOwnerError || error instanceof AppError
      ? error.message
      : 'Local preparation failed. Check the private configuration and production build, then retry read-only checks.',
  );
  process.exitCode = 1;
}
