// Controlled loopback API proof with real Neon and the managed Mainnet provider.
// Ephemeral unfunded keys sign authentication messages only and are never persisted.
import { config } from 'dotenv';
import { access, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { Snapshot } from '../src/lib/types';
config({ path: '.env.local', quiet: true });
const base = 'http://localhost:3004';
const statePath = '.data/tenant-memory-run.json';
const report: Record<string, unknown> = {
  checkedAt: new Date().toISOString(),
  execution:
    'Controlled loopback application; real Neon and Walrus Mainnet; ephemeral simulated wallet identities',
  physicalWalletTest: false,
  productionOnboardingCleared: false,
  originalOwnerMemoriesModified: false,
  paymentSettlementAttempted: false,
  writeLimit: 2,
  retention: 'Managed sponsored provider retention; no renewal or funding submitted',
  quota:
    'Two operations maximum; tenant and global server quotas enforced; stop on provider errors',
};
let stage = 'preconditions';
let stateOpened = false;
const clients: ReturnType<typeof client>[] = [];
function ensure(value: unknown, description: string): asserts value {
  if (!value) throw new Error(description);
}
function client() {
  const cookies = new Map<string, string>();
  return {
    async call(path: string, data?: unknown, expected = 200, method?: string) {
      const response = await fetch(base + '/api/' + path, {
        method: method || (data === undefined ? 'GET' : 'POST'),
        headers: {
          cookie: [...cookies].map(([k, v]) => k + '=' + v).join('; '),
          origin: base,
          'Content-Type': 'application/json',
        },
        body: data === undefined ? undefined : JSON.stringify(data),
        signal: AbortSignal.timeout(45000),
      });
      for (const raw of response.headers.getSetCookie()) {
        const pair = raw.split(';')[0];
        const split = pair.indexOf('=');
        cookies.set(pair.slice(0, split), pair.slice(split + 1));
      }
      ensure(response.status === expected, `Unexpected status during ${stage}`);
      return response.json();
    },
  };
}
async function authenticate(c: ReturnType<typeof client>, key: Ed25519Keypair) {
  const challenge = await c.call('auth/wallet/challenge', { address: key.toSuiAddress() });
  ensure(
    challenge.message.includes(base) && challenge.message.includes('does not authorize'),
    'Login purpose binding missing',
  );
  const signed = await key.signPersonalMessage(new TextEncoder().encode(challenge.message));
  const proof = { id: challenge.id, address: key.toSuiAddress(), signature: signed.signature };
  await c.call('auth/wallet/verify', proof);
  return proof;
}
try {
  ensure(
    process.argv.includes('--confirm-two-sponsored-writes'),
    'Explicit two-write operator flag required',
  );
  let previous = false;
  try {
    await access(statePath);
    previous = true;
  } catch {
    /* first run */
  }
  ensure(
    !previous,
    'Existing proof state preserved; do not generate duplicate fixture accounts or writes',
  );
  ensure(
    process.env.DATABASE_URL && process.env.MEMWAL_PRIVATE_KEY && process.env.MEMWAL_ACCOUNT_ID,
    'Required provider configuration missing',
  );
  ensure(
    (process.env.MEMWAL_SERVER_URL || 'https://relayer.memory.walrus.xyz') ===
      'https://relayer.memory.walrus.xyz',
    'Mainnet provider mismatch',
  );
  ensure(
    process.env.SERVICE_PAYMENT_SETTLEMENT_ENABLED !== 'true',
    'Spending must remain disabled',
  );
  const publicClient = client();
  ensure(
    (await publicClient.call('auth/wallet/status')).allowed,
    'Controlled local server is not ready',
  );
  await writeFile(statePath, JSON.stringify({ ...report, state: 'running' }, null, 2));
  stateOpened = true;
  const identities = [Ed25519Keypair.generate(), Ed25519Keypair.generate()];
  const cases = [];
  const known = '0x' + '1'.repeat(64),
    proposed = '0x' + '2'.repeat(64);
  for (let index = 0; index < 2; index++) {
    stage = `tenant ${index + 1} registration`;
    const c = client();
    clients.push(c);
    const proof = await authenticate(c, identities[index]);
    const session = await c.call('auth/session');
    ensure(session.authenticated && session.role === 'member', 'Member boundary failed');
    const initial: Snapshot = await c.call('snapshot');
    ensure(
      initial.storage === 'Neon Postgres' &&
        initial.invoices.length === 0 &&
        initial.memories.length === 0,
      'New account must be empty and use Neon',
    );
    await c.call('auth/wallet/verify', proof, 401);
    const today = new Date().toISOString().slice(0, 10);
    const invoice = await c.call(
      'invoices',
      {
        vendor: 'Controlled synthetic tenant-isolation supplier',
        number: `TENANT-MAINNET-${index + 1}-${Date.now()}`,
        issued: today,
        due: today,
        amount: '100',
        currency: 'USD',
        memo: 'Synthetic QA invoice. No supplier payment or external human contact.',
        recipient: proposed,
        wallet: '',
        coinType: '',
        tokenAmount: '',
        isDemo: true,
        source: 'manual',
        importKey: randomUUID(),
      },
      201,
    );
    const snapshot: Snapshot = await c.call('snapshot');
    const vendorId = snapshot.invoices.find((i) => i.id === invoice.id)!.vendorId;
    await c.call('vendors/trust', {
      vendorId,
      trustedRecipient: known,
      emailDomain: 'example.invalid',
      contactLabel: 'Synthetic established channel',
      contactMethod: 'phone',
      contactReference: 'QA fixture only; no actual call',
      establishedAt: new Date(Date.now() - 86400000).toISOString(),
      independentlySourced: true,
    });
    const baseline = await c.call('review', { invoiceId: invoice.id, memoryOn: false });
    ensure(baseline.citations.length === 0, 'Memory OFF citation violation');
    stage = `tenant ${index + 1} single sponsored write`;
    const correction = {
      invoiceId: invoice.id,
      findingId: 'recipient-change',
      action: 'remember',
      explanation:
        'Controlled synthetic human correction: require independent review for later recipient changes.',
      scope: 'vendor',
      future: true,
      kind: index === 0 ? 'verify_address' : 'escalate',
      value: '',
      hard: false,
      consent: true,
      operationKey: randomUUID(),
    };
    let job = await c.call('corrections', correction);
    cases.push({
      tenant: index + 1,
      walletAddress: identities[index].toSuiAddress(),
      invoiceId: invoice.id,
      vendorId,
      memoryId: job.id,
      jobId: job.jobId,
      blobId: job.blobId,
      status: job.status,
      operationKey: correction.operationKey,
      namespace: job.namespace,
      newAccountWasEmpty: true,
      role: session.role,
    });
    report.tenants = cases;
    await writeFile(statePath, JSON.stringify(report, null, 2));
    for (let attempt = 0; job.status === 'pending' && attempt < 4; attempt++) {
      job = await c.call('memory/resume', { id: job.id });
      Object.assign(cases[index], { status: job.status, jobId: job.jobId, blobId: job.blobId });
      await writeFile(statePath, JSON.stringify(report, null, 2));
    }
    ensure(
      job.status === 'confirmed' && job.jobId && job.blobId,
      'Provider job not confirmed; preserve pending state and resume it',
    );
    const later = await c.call('demo/next', { invoiceId: invoice.id });
    await c.call('auth/logout', {});
    ensure(!(await c.call('auth/session')).authenticated, 'Logout failed');
    stage = `tenant ${index + 1} separate-session recall`;
    await authenticate(c, identities[index]);
    const returning: Snapshot = await c.call('snapshot');
    ensure(
      returning.invoices.some((i) => i.id === invoice.id),
      'Returning account lost persistence',
    );
    const off = await c.call('review', { invoiceId: later.id, memoryOn: false });
    const on = await c.call('review', { invoiceId: later.id, memoryOn: true });
    const ownedCitation = on.citations.some(
      (p: { id: string; blobId: string }) => p.id === job.id && p.blobId === job.blobId,
    );
    const learnedFinding = on.findings.some((f: { memoryId?: string }) => f.memoryId === job.id);
    ensure(
      ownedCitation && learnedFinding && off.citations.length === 0,
      'Actual later-session recall did not apply the confirmed policy',
    );
    Object.assign(cases[index], {
      laterInvoiceId: later.id,
      ownedCitation,
      learnedFinding,
      baselineCitations: off.citations.length,
      rememberedCitations: on.citations.length,
      returningAccountRecognized: true,
      logoutVerified: true,
      replayRejected: true,
    });
    await writeFile(statePath, JSON.stringify(report, null, 2));
  }
  stage = 'bidirectional authorization and recall boundaries';
  const checks = [];
  for (let index = 0; index < 2; index++) {
    const c = clients[index],
      foreign = cases[1 - index];
    for (const route of ['review', 'instructions/context'])
      await c.call(route, { invoiceId: foreign.invoiceId, memoryOn: true }, 404);
    await c.call(
      'invoices/status',
      {
        invoiceId: foreign.invoiceId,
        status: 'approved',
        reason: 'Synthetic foreign approval attempt',
      },
      404,
    );
    await c.call('memory/resume', { id: foreign.memoryId }, 404);
    await c.call('invoices/' + foreign.invoiceId, undefined, 404, 'DELETE');
    await c.call('service-payments', undefined, 403);
    await c.call('integrations/health', {}, 403);
    const recalled = await c.call('memory/recall', {
      query: 'independent verification changed recipient payment instructions',
    });
    ensure(
      !recalled.citations.some(
        (m: { id: string; blobId: string }) =>
          m.id === foreign.memoryId || m.blobId === foreign.blobId,
      ),
      'Foreign memory disclosed',
    );
    const snapshot: Snapshot = await c.call('snapshot');
    ensure(
      !snapshot.invoices.some((i) => i.id === foreign.invoiceId) &&
        !snapshot.memories.some((m) => m.id === foreign.memoryId),
      'Snapshot boundary failed',
    );
    checks.push({
      tenant: index + 1,
      foreignInvoiceReadDenied: true,
      foreignApprovalDenied: true,
      foreignDeleteDenied: true,
      foreignMemoryResumeDenied: true,
      foreignRecallExcluded: true,
      adminAndPaymentDenied: true,
      foreignSnapshotRecordsExcluded: true,
    });
  }
  report.boundaries = checks;
  report.confirmedAdditionalMemories = cases.filter(
    (c) => c.status === 'confirmed' && c.jobId && c.blobId,
  ).length;
  report.ok = true;
} catch {
  report.ok = false;
  report.incompleteAt = stage;
} finally {
  for (const c of clients)
    try {
      await c.call('auth/logout', {});
    } catch {
      report.logoutUnverified = true;
    }
}
if (stateOpened) await writeFile(statePath, JSON.stringify(report, null, 2) + '\n');
if (report.ok)
  await writeFile(
    'docs/evidence/two-tenant-mainnet-memory.json',
    JSON.stringify(report, null, 2) + '\n',
  );
console.log(
  JSON.stringify({
    ok: report.ok,
    incompleteAt: report.incompleteAt,
    confirmedAdditionalMemories: report.confirmedAdditionalMemories || 0,
    signedOnlyAuthenticationMessages: true,
    noPaymentSettlement: true,
  }),
);
process.exit(report.ok ? 0 : 2);
