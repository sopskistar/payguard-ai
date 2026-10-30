// Standalone loopback server. Production PayGuard signing policy is untouched.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { build } from 'esbuild';
import { z } from 'zod';
import { credentials } from '@grpc/grpc-js';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { verifyTransactionSignature } from '@mysten/sui/verify';
import { fullAddress, GENESIS } from './transaction';
import { ConversionWorkflow, FlowError, validatePrepared, type Authorization } from './workflow';
import { reconcileConversion } from './reconcile';

if (process.env.VERCEL || process.env.VERCEL_ENV)
  throw new Error('Localhost only. Hosted signing is prohibited.');
const dir = '.data/sui-self-deposit';
const preview = JSON.parse(await readFile(`${dir}/preview.json`, 'utf8'));
const parties = JSON.parse(await readFile('.data/production-payment-parties.json', 'utf8'));
if (parties.payer === parties.recipient)
  throw new Error('Wallet B must be separate and absent from this operation.');
await validatePrepared(preview, fullAddress(parties.payer));
const enabled = process.argv.includes('--owner-approved-signing');
const authorization: Authorization | null = enabled
  ? JSON.parse(await readFile(`${dir}/authorization.json`, 'utf8'))
  : null;
const csrf = randomBytes(32).toString('hex');
async function official<T>(operation: (client: SuiGrpcClient) => Promise<T>) {
  const transport = new GrpcTransport({
    host: 'fullnode.mainnet.sui.io:443',
    channelCredentials: credentials.createSsl(),
    timeout: 20000,
    clientOptions: { 'grpc.enable_retries': 0 },
  });
  try {
    const client = new SuiGrpcClient({ network: 'mainnet', transport });
    const { response: info } = await client.ledgerService.getServiceInfo({});
    if (info.chain !== 'mainnet' || info.chainId !== GENESIS) throw new Error('Wrong network');
    return await operation(client);
  } finally {
    transport.close();
  }
}
const workflow = new ConversionWorkflow(dir, preview, authorization, {
  verifySignature: async (bytes, signature) => {
    await official((client) =>
      verifyTransactionSignature(bytes, signature, { address: parties.payer, client }),
    );
  },
  submit: async (bytes, signature) => {
    // Exactly one call, only from the owner's separate Submit button. No executor/retry helper.
    await official(async (client) => {
      const result = await client.core.executeTransaction({
        transaction: bytes,
        signatures: [signature],
        include: { effects: true },
      });
      const tx = result.$kind === 'Transaction' ? result.Transaction : result.FailedTransaction;
      if (tx.digest !== preview.unsignedDigest) throw new Error('Unexpected execution digest');
    });
  },
  reconcile: () => reconcileConversion(preview, dir),
});
if (enabled && !workflow.availability() && !(await workflow.state()))
  throw new Error('Exact owner authorization is missing or stale. Signing was not enabled.');
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
]);
const claimSchema = z
  .object({ sha256: z.string().length(64), address: z.string(), chain: z.literal('sui:mainnet') })
  .strict();
const signedSchema = z
  .object({ bytes: z.string().max(16384), signature: z.string().min(1).max(65536) })
  .strict();
const submitSchema = z.object({ sha256: z.string().length(64) }).strict();
const server = createServer(async (req, res) => {
  const json = (status: number, value: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(value));
  };
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self' https://api.slush.app; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  );
  const origins = ['http://127.0.0.1:4318', 'http://localhost:4318'];
  if (
    !['127.0.0.1:4318', 'localhost:4318'].includes(req.headers.host || '') ||
    (req.headers.origin && !origins.includes(req.headers.origin)) ||
    (req.headers['sec-fetch-site'] &&
      !['none', 'same-origin'].includes(String(req.headers['sec-fetch-site'])))
  ) {
    json(403, { message: 'Local same-origin access only.' });
    return;
  }
  try {
    if (req.method === 'GET' && req.url === '/preview.json') {
      json(200, {
        ...preview,
        mode: enabled ? 'owner-approved-local' : 'review-only',
        signingEnabled: enabled,
        executionEnabled: enabled,
        runtime: {
          csrf,
          authorized: enabled && workflow.availability(),
          state: await workflow.state(),
        },
      });
      return;
    }
    if (req.method === 'GET' && req.url === '/state') {
      json(200, { state: await workflow.state(), authorized: enabled && workflow.availability() });
      return;
    }
    if (req.method === 'GET') {
      const asset = assets.get(req.url || '');
      if (!asset) {
        res.writeHead(404).end('Not found.');
        return;
      }
      res.writeHead(200, { 'Content-Type': asset.type });
      res.end(asset.body);
      return;
    }
    if (req.method !== 'POST' || !enabled) {
      res.writeHead(405, { Allow: 'GET' }).end('Signing disabled.');
      return;
    }
    if (
      req.headers.origin !== `http://${req.headers.host}` ||
      req.headers['x-local-review-token'] !== csrf ||
      !String(req.headers['content-type']).startsWith('application/json')
    ) {
      json(403, { message: 'Local owner page authorization required.' });
      return;
    }
    let body = '';
    for await (const chunk of req) {
      body += chunk.toString();
      if (Buffer.byteLength(body) > 131072) throw new FlowError('BODY_LIMIT', 'Request too large.');
    }
    const input = JSON.parse(body || '{}');
    let state;
    if (req.url === '/claim-signing') {
      const v = claimSchema.parse(input);
      state = await workflow.claim(v.sha256, v.address, v.chain);
    } else if (req.url === '/signed') {
      const v = signedSchema.parse(input);
      state = await workflow.signed(v.bytes, v.signature);
    } else if (req.url === '/submit') {
      const v = submitSchema.parse(input);
      state = await workflow.submit(v.sha256);
    } else if (req.url === '/stop') {
      state = await workflow.stop();
    } else if (req.url === '/reconcile') {
      state = await workflow.reconcile();
    } else {
      json(404, { message: 'No such operation.' });
      return;
    }
    json(200, { state });
  } catch (error) {
    json(error instanceof FlowError ? 409 : 500, {
      code: error instanceof FlowError ? error.code : 'LOCAL_CHECK_FAILED',
      message:
        error instanceof FlowError
          ? error.message
          : 'Local check unavailable. Do not retry signing or submission; inspect the existing attempt.',
    });
  }
});
server.listen(4318, '127.0.0.1', () => {
  console.log(
    `Local conversion ${enabled ? 'owner-approved single-attempt signing' : 'unsigned review'}: http://localhost:4318`,
  );
  console.log(
    'Only explicit owner clicks can request a signature and submit once. Stop on any Slush security warning.',
  );
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close());
