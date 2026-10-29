import { config } from 'dotenv';
import { writeFile } from 'node:fs/promises';
config({ path: '.env.local', quiet: true });
const base = 'https://payguard-ai-henna.vercel.app';
const report: Record<string, unknown> = {
  checkedAt: new Date().toISOString(),
  base,
  memoryWrites: false,
  paymentsSent: false,
};
let cookie = '';
async function call(path: string, data?: unknown) {
  const r = await fetch(base + '/api/' + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(data === undefined ? {} : { origin: base, 'content-type': 'application/json' }),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(45000),
  });
  return { r, data: await r.json() };
}
async function signIn() {
  const result = await call('auth/login', { password: process.env.OWNER_PASSWORD });
  if (result.r.status !== 200) throw new Error('OWNER_PASSWORD: production login rejected');
  const raw = result.r.headers.getSetCookie().find((c) => c.startsWith('payguard_session=')) || '';
  cookie = raw.split(';')[0];
  report.cookie = {
    secure: /; secure/i.test(raw),
    httpOnly: /httponly/i.test(raw),
    sameSiteStrict: /samesite=strict/i.test(raw),
  };
}
let stage = 'release';
try {
  report.release = (await call('release')).data;
  report.walletAccess = (await call('auth/wallet/status')).data;
  stage = 'owner login';
  await signIn();
  report.session = (await call('auth/session')).data;
  stage = 'Neon snapshot';
  const { r: snapshot, data: s } = await call('snapshot');
  const confirmed = s.memories.filter(
    (m: { status: string; jobId?: string; blobId?: string }) =>
      m.status === 'confirmed' && m.jobId && m.blobId,
  );
  report.workspace = {
    status: snapshot.status,
    mode: s.mode,
    storage: s.storage,
    confirmedMemories: confirmed.length,
    configured: s.integrations,
  };
  stage = 'provider health';
  const health = await call('integrations/health', {});
  report.health = Object.fromEntries(
    ['database', 'walrus', 'tatum'].map((name) => [name, { status: health.data[name]?.status }]),
  );
  stage = 'Tatum transaction';
  const chain = await call('transactions/inspect', {
    digest: 'os1iG8zow278c6hqxbuyxnvMUjzThsD8GTY8atdfzW6',
  });
  report.tatum = {
    status: chain.r.status,
    chainId: chain.data.chainId,
    checkpoint: chain.data.checkpoint,
    digest: chain.data.transaction?.digest,
  };
  const invoice = s.invoices.find(
    (i: { isDemo: boolean; number: string }) => i.isDemo && i.number === 'NS-1048',
  );
  if (!invoice) throw new Error('Synthetic review source unavailable');
  stage = 'memory baseline';
  const off = await call('review', { invoiceId: invoice.id, memoryOn: false });
  stage = 'first recall';
  const on = await call('review', { invoiceId: invoice.id, memoryOn: true });
  const audit = (await call('snapshot')).data.audit.find(
    (e: { type: string; entityId: string; detail: { memoryOn?: boolean } }) =>
      e.entityId === invoice.id && e.type === 'review.evaluated' && e.detail.memoryOn,
  );
  stage = 'logout';
  await call('auth/logout', {});
  report.revokedCookieRejected = (await call('auth/session')).data.authenticated === false;
  cookie = '';
  stage = 'new owner session';
  await signIn();
  const next = (await call('snapshot')).data;
  stage = 'new-session recall';
  const recalled = await call('review', { invoiceId: invoice.id, memoryOn: true });
  report.recall = {
    offStatus: off.r.status,
    onStatus: on.r.status,
    newSessionStatus: recalled.r.status,
    offCitations: off.data.citations?.length,
    firstCitations: on.data.citations?.length,
    newSessionCitations: recalled.data.citations?.length,
    ownedCitations: recalled.data.citations?.every((c: { id: string; blobId: string }) =>
      confirmed.some((m: { id: string; blobId: string }) => m.id === c.id && m.blobId === c.blobId),
    ),
    baselinePreserved: off.data.findings?.every((f: { id: string }) =>
      recalled.data.findings?.some((g: { id: string }) => f.id === g.id),
    ),
    auditPersisted: !!audit && next.audit.some((e: { id: string }) => e.id === audit.id),
    blobIds: recalled.data.citations?.map((c: { blobId: string }) => c.blobId),
  };
  const service = await call('service-payments');
  report.service = {
    configured: service.data.configured,
    network: service.data.network,
    mainnetImplemented: service.data.mainnetImplemented,
    signingAllowed: service.data.signingAllowed,
    mainnetEnabled: service.data.mainnetEnabled,
    sessionCapAtomic: service.data.sessionCapAtomic,
  };
  stage = 'production Mainnet payment preflight';
  const preflight = await call('service-payments/preflight');
  const { payer, recipient, ...publicPreflight } = preflight.data;
  const safePreflight = {
    ...publicPreflight,
    execution: 'Authenticated production read-only preflight; no wallet connection or payment',
    status: preflight.r.status,
    payerConfigured: !!payer,
    recipientConfigured: !!recipient,
    signatureRequested: false,
    settlementAttempted: false,
  };
  report.paymentPreflight = {
    status: preflight.r.status,
    network: preflight.data.network,
    genesis: preflight.data.genesis,
    spending: preflight.data.spending,
  };
  await writeFile(
    'docs/evidence/production-payment-preflight.json',
    JSON.stringify(safePreflight, null, 2) + '\n',
  );
  report.ok =
    Object.values(report.health as Record<string, { status: string }>).every(
      (h) => h.status === 'Connected',
    ) &&
    Object.values(report.cookie as Record<string, boolean>).every(Boolean) &&
    report.revokedCookieRejected === true &&
    snapshot.status === 200 &&
    s.mode === 'owner' &&
    s.storage === 'Neon Postgres' &&
    confirmed.length === 30 &&
    service.data.mainnetImplemented === true &&
    service.data.network === 'sui:mainnet' &&
    service.data.signingAllowed === false &&
    service.data.sessionCapAtomic === '3000000' &&
    preflight.r.status === 200 &&
    preflight.data.network === 'sui:mainnet' &&
    preflight.data.genesis === '4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S' &&
    preflight.data.spending === false &&
    chain.r.status === 200 &&
    chain.data.chainId === '35834a8a' &&
    recalled.r.status === 200 &&
    recalled.data.citations?.length > 0 &&
    (
      report.recall as {
        auditPersisted: boolean;
        baselinePreserved: boolean;
        ownedCitations: boolean;
      }
    ).auditPersisted &&
    (report.recall as { baselinePreserved: boolean }).baselinePreserved &&
    (report.recall as { ownedCitations: boolean }).ownedCitations;
} catch {
  report.ok = false;
  report.incompleteAt = stage;
} finally {
  if (cookie)
    try {
      await call('auth/logout', {});
    } catch {
      report.logoutUnverified = true;
    }
}
await writeFile('docs/evidence/production-core-smoke.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 2);
