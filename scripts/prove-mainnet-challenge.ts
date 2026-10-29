// Real first-party HTTP challenge, synthetic unfunded parties, no signature or settlement.
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { parseServiceChallenge, MAINNET_GENESIS } from '../src/lib/service-protocol';
config({ path: '.env.local', quiet: true });
const base = 'http://localhost:3004';
let cookie = '';
let id = '';
let stage = 'owner login';
const report: Record<string, unknown> = {
  checkedAt: new Date().toISOString(),
  execution: 'Controlled loopback application, real Neon and facilitator supported read',
  syntheticUnfundedParties: true,
  financialApprovalGranted: false,
  signatureRequested: false,
  settlementAttempted: false,
};
async function call(path: string, data?: unknown) {
  const r = await fetch(base + '/api/' + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: { cookie, origin: base, 'content-type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(45000),
  });
  if (path === 'auth/login')
    cookie = (r.headers.getSetCookie().find((c) => c.startsWith('payguard_session=')) || '').split(
      ';',
    )[0];
  return { r, data: await r.json() };
}
try {
  const login = await call('auth/login', { password: process.env.OWNER_PASSWORD });
  if (login.r.status !== 200) throw new Error('Owner authentication failed');
  stage = 'quote-only metadata';
  const metadata = await call('service-payments');
  report.metadata = {
    status: metadata.r.status,
    configured: metadata.data.configured,
    network: metadata.data.network,
    signingAllowed: metadata.data.signingAllowed,
  };
  if (
    metadata.data.signingAllowed ||
    !metadata.data.configured ||
    metadata.data.network !== 'sui:mainnet'
  )
    throw new Error('Controlled Mainnet quote-only configuration required');
  const snapshotResponse = await call('snapshot');
  report.snapshot = {
    status: snapshotResponse.r.status,
    mode: snapshotResponse.data.mode,
    invoiceCount: snapshotResponse.data.invoices?.length,
  };
  const snapshot = snapshotResponse.data;
  stage = 'synthetic invoice selection';
  const invoice = snapshot.invoices.find(
    (i: { isDemo: boolean; number: string }) => i.isDemo && i.number === 'NS-1048',
  );
  if (!invoice) throw new Error('Synthetic source invoice missing');
  stage = 'actual HTTP challenge';
  const quote = await call('service-payments', {
    invoiceId: invoice.id,
    operationKey: randomUUID(),
  });
  id = quote.data.id;
  report.challengeStatus = quote.r.status;
  const header = quote.r.headers.get('PAYMENT-REQUIRED');
  if (quote.r.status !== 402 || !header) throw new Error('Authentic HTTP 402 required');
  stage = 'challenge validation';
  const challenge = parseServiceChallenge(
    JSON.parse(Buffer.from(header, 'base64').toString()),
    base,
    'sui:mainnet',
  );
  const { id: quoteId, expiresAt, ...body } = quote.data;
  const bodyChallenge = parseServiceChallenge(body, base, 'sui:mainnet');
  report.headerMatchesBody = JSON.stringify(bodyChallenge) === JSON.stringify(challenge);
  if (!report.headerMatchesBody) throw new Error('HTTP header/body mismatch');
  const resource = await call('service-payments/' + id, {});
  stage = 'spending-disabled approval rejection';
  const approval = await call('service-payments/' + id + '/approve', {
    approved: true,
    payer: '0x' + '7'.repeat(64),
  });
  stage = 'live read-only preflight';
  const preflight = await call('service-payments/preflight');
  const cancelled = await call('service-payments/' + id + '/cancel', {});
  Object.assign(report, {
    status: quote.r.status,
    resourceStatus: resource.r.status,
    challenge,
    quoteId,
    expiresAt,
    headerMatchesBody: true,
    spendGateStatus: approval.r.status,
    cancelledStatus: cancelled.r.status,
    preflightNetwork: preflight.data.network,
    tatumGenesis: preflight.data.genesis,
    payerGasAtomic: preflight.data.maxPayerGasAtomic,
    ok:
      resource.r.status === 402 &&
      approval.r.status === 503 &&
      cancelled.r.status === 200 &&
      preflight.data.genesis === MAINNET_GENESIS,
  });
} catch {
  report.ok = false;
  report.incompleteAt = stage;
} finally {
  if (id && !report.cancelledStatus)
    try {
      await call('service-payments/' + id + '/cancel', {});
    } catch {
      report.cancellationUnverified = true;
    }
  if (cookie)
    try {
      await call('auth/logout', {});
    } catch {
      report.logoutUnverified = true;
    }
}
await writeFile(
  'docs/evidence/mainnet-http-challenge.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    ok: report.ok,
    incompleteAt: report.incompleteAt,
    genuineChallengeStatus: report.status,
    signatureRequested: false,
    settlementAttempted: false,
  }),
);
process.exit(report.ok ? 0 : 2);
