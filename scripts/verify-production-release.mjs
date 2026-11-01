// Read-only payment/provider verification, normal review audits and two free unfunded auth profiles.
// Never requests a quote, approves, signs a transaction, submits settlement or writes memory.
import { config } from 'dotenv';
import { chromium } from '@playwright/test';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

config({ path: '.env.local', quiet: true });
const base = 'https://payguard-ai-henna.vercel.app';
const expected = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(expected || '')) throw Error('Supply the exact deployed Git SHA.');
const evidence = JSON.parse(await readFile('docs/evidence/mainnet-service-reconciliation.json'));
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
    '/home/sopski/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell',
  args: ['--disable-http2'],
});
const owner = await browser.newContext();
const customers = [await browser.newContext(), await browser.newContext()];
const report = {
  checkedAt: new Date().toISOString(),
  base,
  quoteRequested: false,
  transactionSignatureRequested: false,
  settlementSubmission: false,
  memoryWrite: false,
  physicalProviderTest: false,
  freeAuthenticationTestProfiles: 0,
  checks: [],
};
function check(name, passed) {
  report.checks.push({ name, passed: !!passed });
  if (!passed) throw Error(name);
}
async function get(context, path) {
  const response = await context.request.get(base + '/api/' + path);
  check(path + ' HTTP 200', response.status() === 200);
  return response.json();
}
async function post(context, path, data) {
  return context.request.post(base + '/api/' + path, { headers: { origin: base }, data });
}
try {
  report.release = await get(owner, 'release');
  check('exact deployed source SHA', report.release.commit === expected);
  for (const path of ['/', '/courtroom', '/try', '/proof', '/connect', '/services', '/app']) {
    const response = await owner.request.get(base + path);
    check('public route ' + path, response.status() === 200);
  }
  check(
    'anonymous financial records protected',
    (await owner.request.get(base + '/api/service-payments')).status() === 401,
  );
  report.walletStatus = await get(owner, 'auth/wallet/status');
  check(
    'HTTPS wallet connection/authentication and financial origin permitted',
    report.walletStatus.allowed &&
      report.walletStatus.slushBlocked === false &&
      report.walletStatus.paymentSigningAllowed === true,
  );

  const login = await post(owner, 'auth/login', { password: process.env.OWNER_PASSWORD });
  check('owner login', login.status() === 200);
  const cookie = (await owner.cookies()).find((c) => c.name === 'payguard_session');
  report.ownerCookie = {
    secure: cookie?.secure,
    httpOnly: cookie?.httpOnly,
    sameSiteStrict: cookie?.sameSite === 'Strict',
  };
  check('secure owner session flags', Object.values(report.ownerCookie).every(Boolean));
  const snapshot = await get(owner, 'snapshot');
  report.ownerMemories = snapshot.memories.filter((m) => m.status === 'confirmed').length;
  check(
    'Neon owner workspace and 30 isolated owner memories',
    snapshot.mode === 'owner' &&
      snapshot.storage === 'Neon Postgres' &&
      report.ownerMemories === 30,
  );
  const metadata = await get(owner, 'service-payments');
  report.ownerPaymentPolicy = {
    configured: metadata.configured,
    preparationAllowed: metadata.preparationAllowed,
    signingAllowed: metadata.signingAllowed,
    capabilities: metadata.capabilities,
  };
  check(
    'production origin policy is separate from owner financial switch',
    metadata.configured &&
      metadata.preparationAllowed &&
      metadata.capabilities.financialOriginAllowed &&
      metadata.capabilities.providerVerdict === 'unobserved',
  );
  const memoryInvoice = snapshot.invoices.find(
    (i) => i.number === 'X402-EXPERIMENT-03' && i.isDemo,
  );
  if (!memoryInvoice) throw Error('Existing synthetic memory comparison invoice missing.');
  const offResponse = await post(owner, 'review', { invoiceId: memoryInvoice.id, memoryOn: false });
  const onResponse = await post(owner, 'review', { invoiceId: memoryInvoice.id, memoryOn: true });
  check(
    'fresh production OFF/ON reviews',
    offResponse.status() === 200 && onResponse.status() === 200,
  );
  const off = await offResponse.json(),
    on = await onResponse.json();
  const gateResponse = await post(owner, 'instructions/context', { invoiceId: memoryInvoice.id });
  check('production verification gate', gateResponse.status() === 200);
  const verification = await gateResponse.json();
  const captured = JSON.parse(await readFile('docs/evidence/courtroom.json'));
  const approvedBlobs = new Set(captured.freshRecall.citations.map((c) => c.blobId));
  report.memory = {
    invoice: memoryInvoice.number,
    offCitations: off.citations.length,
    onCitations: on.citations.length,
    baselineRetained: off.findings.every((f) => on.findings.some((g) => f.id === g.id)),
    previouslyConfirmedBlobsOnly: on.citations.every((c) => approvedBlobs.has(c.blobId)),
    humanHold: verification.gate.allowed === false,
    freshAuthenticatedProductionSession: true,
    source: 'Actual authenticated Production Walrus recall; no memory write',
  };
  check(
    'real production recall enriches review and preserves the hold',
    report.memory.offCitations === 0 &&
      report.memory.onCitations === 7 &&
      report.memory.baselineRetained &&
      report.memory.previouslyConfirmedBlobsOnly &&
      report.memory.humanHold,
  );
  report.receipts = [];
  for (const payment of evidence.payments) {
    check(
      'owned synthetic invoice ' + payment.invoice,
      snapshot.invoices.some((i) => i.number === payment.invoice && i.isDemo),
    );
    check(
      'unique persisted settled intent ' + payment.invoice,
      metadata.intents.filter(
        (i) => i.id === payment.quoteId && i.state === 'settled' && i.digest === payment.digest,
      ).length === 1,
    );
    const responseA = await post(owner, 'service-payments/' + payment.quoteId + '/resume', {});
    const responseB = await post(owner, 'service-payments/' + payment.quoteId + '/resume', {});
    check(
      'receipt reopens twice ' + payment.invoice,
      responseA.status() === 200 && responseB.status() === 200,
    );
    const a = await responseA.json(),
      b = await responseB.json();
    check(
      'same receipt and exact merchant credit ' + payment.invoice,
      a.state === 'settled' &&
        b.state === 'settled' &&
        a.receipt.id === payment.receiptId &&
        a.receipt.id === b.receipt.id &&
        a.receipt.digest === payment.digest &&
        a.receipt.evidence.receivedAtomic === '1000000',
    );
    check(
      'saved analysis matches reconciled report ' + payment.invoice,
      JSON.stringify(a.receipt.result) === JSON.stringify(payment.result) &&
        JSON.stringify(a.receipt.result) === JSON.stringify(b.receipt.result),
    );
    report.receipts.push({
      invoice: payment.invoice,
      digest: payment.digest,
      sameReceiptOnResume: true,
      merchantCreditAtomic: a.receipt.evidence.receivedAtomic,
      resultHash: createHash('sha256').update(JSON.stringify(a.receipt.result)).digest('hex'),
    });
  }
  const ownerPage = await owner.newPage();
  let financialRequests = 0;
  ownerPage.on('request', (r) => {
    if (
      r.method() === 'POST' &&
      (r.headers()['payment-signature'] ||
        /\/api\/service-payments(?:$|\/[^/]+\/(approve|events)$)/.test(new URL(r.url()).pathname))
    )
      financialRequests++;
  });
  await ownerPage.goto(base + '/services?invoice=X402-EXPERIMENT-02', {
    waitUntil: 'domcontentloaded',
  });
  await ownerPage
    .getByRole('region', { name: 'Server payment capabilities' })
    .waitFor({ timeout: 30000 });
  await ownerPage
    .locator('[aria-label="Selected invoice details"]')
    .filter({ hasText: 'X402-EXPERIMENT-02' })
    .waitFor();
  check(
    'owner services displays loaded capabilities without a new payment',
    financialRequests === 0,
  );

  // These are real cryptographic personal-message proofs against the live server,
  // not physical browser-extension compatibility tests. The keys are unfunded and never saved.
  report.customers = [];
  let firstSession;
  for (const [index, context] of customers.entries()) {
    const key = Ed25519Keypair.generate();
    const challengeResponse = await post(context, 'auth/wallet/challenge', {
      address: key.toSuiAddress(),
    });
    check('customer challenge ' + index, challengeResponse.status() === 200);
    const challenge = await challengeResponse.json();
    const signed = await key.signPersonalMessage(new TextEncoder().encode(challenge.message));
    const proof = { id: challenge.id, address: key.toSuiAddress(), signature: signed.signature };
    check(
      'customer free signature verified ' + index,
      (await post(context, 'auth/wallet/verify', proof)).status() === 200,
    );
    report.freeAuthenticationTestProfiles++;
    check(
      'customer nonce replay rejected ' + index,
      (await post(context, 'auth/wallet/verify', proof)).status() === 401,
    );
    const session = await get(context, 'auth/session');
    if (index === 0) firstSession = session;
    else
      check(
        'independent customer identities',
        session.walletAddress !== firstSession.walletAddress,
      );
    const member = await get(context, 'snapshot');
    const checkout = await get(context, 'service-payments');
    check(
      'empty isolated customer workspace ' + index,
      member.mode === 'member' &&
        member.identity.walletAddress === key.toSuiAddress() &&
        member.invoices.length === 0 &&
        member.memories.length === 0 &&
        checkout.intents.length === 0,
    );
    check(
      'customer checkout uses authenticated payer and bounded pilot ' + index,
      checkout.audience === 'customer' &&
        checkout.dedicatedPayer === key.toSuiAddress() &&
        checkout.configured &&
        checkout.preparationAllowed &&
        checkout.signingAllowed &&
        checkout.publicPilot.capAtomic === '20000000' &&
        checkout.exposure.capAtomic === '3000000',
    );
    check(
      'customer cannot inspect administrator settings ' + index,
      (await context.request.get(base + '/api/service-payments/setup')).status() === 403,
    );
    check(
      'customer cannot reopen an owner receipt ' + index,
      (
        await post(context, 'service-payments/' + evidence.payments[0].quoteId + '/resume', {})
      ).status() === 404,
    );
    report.customers.push({
      memberAuthenticated: session.role === 'member',
      emptyIsolatedWorkspace: true,
      ownPayer: true,
      signingAvailableInApplication: checkout.signingAllowed,
      pilot: checkout.publicPilot,
      physicalProviderAcceptance: 'unverified',
    });
  }
  for (const context of [owner, ...customers]) {
    check('explicit logout', (await post(context, 'auth/logout', {})).status() === 200);
    check('session revoked', (await get(context, 'auth/session')).authenticated === false);
  }
  report.ok = true;
} catch (error) {
  report.ok = false;
  report.error = error.message;
  process.exitCode = 1;
} finally {
  for (const context of [owner, ...customers]) {
    await post(context, 'auth/logout', {}).catch(() => {});
    await context.close();
  }
  await browser.close();
}
await writeFile(
  'docs/evidence/hackathon-production-smoke.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report, null, 2));
