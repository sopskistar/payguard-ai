// A loopback-only review page. No signing, execution, proxy or write endpoints.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { fromBase64 } from '@mysten/sui/utils';
import { AMOUNT, CHAIN, GAS_BUDGET, GENESIS, assertExactBytes, fullAddress } from './transaction';

const preview = JSON.parse(await readFile('.data/sui-self-deposit/preview.json', 'utf8'));
const parties = JSON.parse(await readFile('.data/production-payment-parties.json', 'utf8'));
if (
  preview.plan.payer !== fullAddress(parties.payer) ||
  parties.payer === parties.recipient ||
  preview.chain !== CHAIN ||
  preview.genesis !== GENESIS ||
  preview.amountMist !== AMOUNT.toString() ||
  preview.gasBudgetMist !== GAS_BUDGET.toString()
)
  throw new Error('Preview does not match the configured Wallet A and fixed Mainnet terms.');
await assertExactBytes(fromBase64(preview.unsignedBytes), preview.plan);
if (
  preview.signingEnabled !== false ||
  preview.executionEnabled !== false ||
  preview.mode !== 'review-only'
)
  throw new Error('This utility only serves unsigned review snapshots.');
const bundle = await build({
  entryPoints: ['tools/sui-self-deposit/client.ts'],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'esm',
  target: 'es2022',
  minify: false,
});
const assets = new Map([
  ['/', { type: 'text/html', body: await readFile('tools/sui-self-deposit/index.html') }],
  ['/client.js', { type: 'text/javascript', body: Buffer.from(bundle.outputFiles[0].contents) }],
  ['/style.css', { type: 'text/css', body: await readFile('tools/sui-self-deposit/style.css') }],
  ['/preview.json', { type: 'application/json', body: Buffer.from(JSON.stringify(preview)) }],
]);
const server = createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self' https://api.slush.app; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  );
  if (
    !['127.0.0.1:4318', 'localhost:4318'].includes(req.headers.host || '') ||
    (req.headers.origin &&
      !['http://127.0.0.1:4318', 'http://localhost:4318'].includes(req.headers.origin)) ||
    (req.headers['sec-fetch-site'] &&
      !['none', 'same-origin'].includes(String(req.headers['sec-fetch-site'])))
  ) {
    res.writeHead(403).end('Local same-origin access only.');
    return;
  }
  if (req.method !== 'GET') {
    res.writeHead(405, { Allow: 'GET' }).end('Review only.');
    return;
  }
  const asset = assets.get(req.url || '');
  if (!asset) {
    res.writeHead(404).end('Not found.');
    return;
  }
  res.writeHead(200, { 'Content-Type': asset.type });
  res.end(asset.body);
});
server.listen(4318, '127.0.0.1', () => {
  console.log('Unsigned review only: http://localhost:4318');
  console.log('No signing or broadcasting endpoints. Stop if Slush shows any security warning.');
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close());
