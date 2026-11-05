import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import * as s from '@/db/schema';
import { DEFAULT_PREFERENCES } from '@/lib/types';
import {
  createOrganization,
  updateMember,
  proposeChange,
  decideChange,
  businessSnapshot,
} from '@/lib/business';
import { businessAccess } from '@/lib/organization-access';
import { saveInvoice, ownedInvoice, changeStatus } from '@/lib/store';
import { saveTrust, saveInstructions, recordHumanCheck, trustContext } from '@/lib/verify-store';
import { supplierTimeline } from '@/lib/supplier-timeline';
import {
  createDocument,
  readDocument,
  deleteDocument,
  purgeExpiredDocuments,
} from '@/lib/documents';
const memoryMock = vi.hoisted(() => ({ recall: vi.fn() }));
vi.mock('@mysten-incubation/memwal', () => ({
  MemWal: { create: () => ({ recall: memoryMock.recall }) },
}));
import { recallMemories, namespaceFor } from '@/lib/integrations/memory';
let directory: string;
const a = '0x' + 'a'.repeat(64),
  b = '0x' + 'b'.repeat(64);
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'payguard-business-unit-'));
  vi.stubEnv('DATABASE_URL', '');
  vi.stubEnv('LOCAL_DATABASE_PATH', directory);
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', '');
  await migrate(await db(), { migrationsFolder: 'drizzle' });
});
afterAll(async () => {
  await ((await db()) as unknown as { $client: PGlite }).$client.close();
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});
async function fixture() {
  const identities = Array.from({ length: 4 }, () => ({
    id: randomUUID(),
    wallet: '0x' + randomUUID().replaceAll('-', '').repeat(2),
  }));
  for (const i of identities)
    await (await db()).insert(s.users).values({
      id: i.id,
      name: 'Synthetic business identity',
      role: 'member',
      walletAddress: i.wallet,
      settings: DEFAULT_PREFERENCES,
    });
  const [root, verifier, requester, outsider] = identities;
  const input = {
    vendor: 'Synthetic supplier ' + randomUUID().slice(0, 6),
    number: 'SYN-' + randomUUID().slice(0, 8),
    issued: '2026-11-05',
    due: '2026-12-01',
    amount: '500',
    currency: 'USD',
    memo: 'Synthetic invoice source; independent supplier check required',
    recipient: b,
    wallet: '',
    coinType: '',
    tokenAmount: '',
    source: 'manual' as const,
    isDemo: true,
    importKey: randomUUID(),
  };
  const id = await saveInvoice(root.id, input),
    invoice = await ownedInvoice(root.id, id);
  await saveTrust(root.id, {
    vendorId: invoice.vendorId,
    trustedRecipient: a,
    emailDomain: 'supplier.example',
    contactLabel: 'Independent purchasing contact',
    contactMethod: 'phone',
    contactReference: 'Previously established contact SYN-01',
    establishedAt: '2026-10-01T00:00:00Z',
    independentlySourced: true,
  });
  await saveInstructions(root.id, {
    invoiceId: id,
    senderEmail: 'accounts@supplier.example',
    replyTo: '',
    message: 'A synthetic request to update payment instructions.',
    requestedContact: '',
    receivedAt: '2026-11-05T00:00:00Z',
  });
  const org = await createOrganization(root.id, {
    name: 'Synthetic organization',
    confirmWorkspaceSharing: true,
  });
  await updateMember(org.id, root.id, { wallet: verifier.wallet, role: 'verifier', revoke: false });
  await updateMember(org.id, root.id, {
    wallet: requester.wallet,
    role: 'requester',
    revoke: false,
  });
  const proposal = await proposeChange(org.id, requester.id, {
    invoiceId: id,
    operationKey: randomUUID(),
    note: 'Synthetic requester compared the original document.',
  });
  return { root, verifier, requester, outsider, org, id, invoice, input, proposal };
}
const decision = {
  outcome: 'confirmed' as const,
  method: 'phone' as const,
  note: 'Synthetic separate verifier called the established contact and checked the exact destination.',
  evidenceReference: 'SYN callback record 001',
  usedEstablishedContact: true as const,
};
it('requires explicit wallet-bound membership and isolates another organization', async () => {
  const f = await fixture();
  await expect(businessSnapshot(f.org.id, f.outsider.id)).rejects.toMatchObject({
    code: 'BUSINESS_ROLE',
  });
  await expect(
    updateMember(f.org.id, f.requester.id, {
      wallet: f.outsider.wallet,
      role: 'admin',
      revoke: false,
    }),
  ).rejects.toMatchObject({ code: 'BUSINESS_ROLE' });
  await expect(
    updateMember(f.org.id, f.root.id, {
      wallet: '0x' + 'f'.repeat(64),
      role: 'verifier',
      revoke: false,
    }),
  ).rejects.toMatchObject({ code: 'IDENTITY_REQUIRED' });
});
it('requires a distinct verifier and does not accept requester role escalation', async () => {
  const f = await fixture();
  await expect(
    decideChange(f.org.id, f.requester.id, f.proposal.id, decision),
  ).rejects.toMatchObject({ code: 'BUSINESS_ROLE' });
  await updateMember(f.org.id, f.root.id, {
    wallet: f.requester.wallet,
    role: 'verifier',
    revoke: false,
  });
  await expect(
    decideChange(f.org.id, f.requester.id, f.proposal.id, decision),
  ).rejects.toMatchObject({ code: 'SELF_APPROVAL' });
  expect((await businessSnapshot(f.org.id, f.root.id)).changes[0].state).toBe('pending');
});
it('does not let an administrator approve its own proposal', async () => {
  const f = await fixture();
  const p = await proposeChange(f.org.id, f.root.id, {
    invoiceId: f.id,
    operationKey: randomUUID(),
    note: 'Synthetic administrator acts as requester.',
  });
  await expect(decideChange(f.org.id, f.root.id, p.id, decision)).rejects.toMatchObject({
    code: 'SELF_APPROVAL',
  });
});
it('records a real distinct identity, exact evidence, profile revision and valid invoice gate atomically', async () => {
  const f = await fixture();
  const before = await trustContext(f.root.id, await ownedInvoice(f.root.id, f.id));
  expect(before.gate.allowed).toBe(false);
  const result = await decideChange(f.org.id, f.verifier.id, f.proposal.id, decision);
  expect(result).toMatchObject({
    state: 'approved',
    proposedBy: f.requester.id,
    checkedBy: f.verifier.id,
    proposedRecipient: b,
    profileRevision: 2,
  });
  const context = await trustContext(f.root.id, await ownedInvoice(f.root.id, f.id));
  expect(context.gate.allowed).toBe(true);
  expect(context.profile?.trustedRecipient).toBe(b);
  expect(context.verification?.instructionHash).toBe(result.instructionHash);
  const events = await supplierTimeline(f.root.id, f.invoice.vendorId);
  expect(
    events.some(
      (e) => e.evidence.actorId === f.verifier.id && e.title.includes('distinct verifier'),
    ),
  ).toBe(true);
  await changeStatus(
    f.root.id,
    f.id,
    'approved',
    'The exact change has a separate verified approval.',
  );
});
it('prevents bypass through legacy trust, human-check and status endpoints', async () => {
  const f = await fixture();
  const context = await trustContext(f.root.id, await ownedInvoice(f.root.id, f.id));
  await expect(
    recordHumanCheck(f.root.id, {
      invoiceId: f.id,
      profileRevision: 1,
      instructionHash: context.instructionHash,
      outcome: 'confirmed',
      method: 'phone',
      note: 'An attempted self-check bypass in a synthetic fixture.',
      usedEstablishedContact: true,
    }),
  ).rejects.toMatchObject({ code: 'TWO_PERSON_REQUIRED' });
  await expect(
    saveTrust(f.root.id, { ...context.profile!, independentlySourced: true }),
  ).rejects.toMatchObject({ code: 'TWO_PERSON_REQUIRED' });
  await expect(
    changeStatus(
      f.root.id,
      f.id,
      'approved',
      'A legacy caller must not bypass the second identity.',
    ),
  ).rejects.toMatchObject({ code: 'VERIFY_REQUIRED' });
});
it('revokes stale-session authority immediately and preserves pending state', async () => {
  const f = await fixture();
  await updateMember(f.org.id, f.root.id, {
    wallet: f.verifier.wallet,
    role: 'verifier',
    revoke: true,
  });
  await expect(businessAccess(f.org.id, f.verifier.id)).rejects.toMatchObject({
    code: 'BUSINESS_ROLE',
  });
  await expect(
    decideChange(f.org.id, f.verifier.id, f.proposal.id, decision),
  ).rejects.toMatchObject({ code: 'BUSINESS_ROLE' });
});
it('serializes concurrent independent approvals with one successful decision', async () => {
  const f = await fixture();
  await updateMember(f.org.id, f.root.id, {
    wallet: f.outsider.wallet,
    role: 'verifier',
    revoke: false,
  });
  const results = await Promise.allSettled([
    decideChange(f.org.id, f.verifier.id, f.proposal.id, decision),
    decideChange(f.org.id, f.outsider.id, f.proposal.id, decision),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  const events = await (
    await db()
  )
    .select()
    .from(s.auditEvents)
    .where(
      and(
        eq(s.auditEvents.tenantId, f.root.id),
        eq(s.auditEvents.type, 'business.change_approved'),
      ),
    );
  expect(events).toHaveLength(1);
});
it('invalidates approval after invoice edits and requires a new proposal', async () => {
  const f = await fixture();
  await decideChange(f.org.id, f.verifier.id, f.proposal.id, decision);
  await saveInvoice(
    f.root.id,
    { ...f.input, memo: 'Materially changed synthetic invoice instructions.' },
    f.id,
    f.requester.id,
  );
  expect((await businessSnapshot(f.org.id, f.root.id)).changes[0].state).toBe('invalidated');
  expect((await trustContext(f.root.id, await ownedInvoice(f.root.id, f.id))).gate.allowed).toBe(
    false,
  );
  await expect(
    decideChange(f.org.id, f.verifier.id, f.proposal.id, decision),
  ).rejects.toMatchObject({ code: 'PROPOSAL_CLOSED' });
});
it('invalidates pending proposals when source instructions change', async () => {
  const f = await fixture();
  await saveInstructions(
    f.root.id,
    {
      invoiceId: f.id,
      senderEmail: 'accounts@supplier.example',
      replyTo: '',
      message: 'A changed payment request must invalidate the original proposal.',
      requestedContact: '',
      receivedAt: '2026-11-05T00:00:00Z',
    },
    f.requester.id,
  );
  await expect(
    decideChange(f.org.id, f.verifier.id, f.proposal.id, decision),
  ).rejects.toMatchObject({ code: 'PROPOSAL_CLOSED' });
});
it('requires the old established channel and does not accept a newly supplied one', async () => {
  const f = await fixture();
  await expect(
    decideChange(f.org.id, f.verifier.id, f.proposal.id, { ...decision, method: 'secure_portal' }),
  ).rejects.toMatchObject({ code: 'ESTABLISHED_CONTACT' });
});
it('supports rejection and clarification without establishing the proposed destination', async () => {
  const f = await fixture();
  let result = await decideChange(f.org.id, f.verifier.id, f.proposal.id, {
    ...decision,
    outcome: 'clarification',
  });
  expect(result.state).toBe('clarification');
  expect(
    (await trustContext(f.root.id, await ownedInvoice(f.root.id, f.id))).profile?.trustedRecipient,
  ).toBe(a);
  result = await decideChange(f.org.id, f.verifier.id, f.proposal.id, {
    ...decision,
    outcome: 'rejected',
  });
  expect(result.state).toBe('rejected');
  expect((await trustContext(f.root.id, await ownedInvoice(f.root.id, f.id))).gate.allowed).toBe(
    false,
  );
});
it('expires verification and retains honest chronological audit evidence', async () => {
  const f = await fixture();
  await decideChange(f.org.id, f.verifier.id, f.proposal.id, decision);
  await (
    await db()
  )
    .update(s.supplierChanges)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(s.supplierChanges.id, f.proposal.id));
  expect((await trustContext(f.root.id, await ownedInvoice(f.root.id, f.id))).gate.allowed).toBe(
    false,
  );
  const timeline = await supplierTimeline(f.root.id, f.invoice.vendorId);
  expect(
    timeline.every((e, i) => i === 0 || Date.parse(timeline[i - 1].at) >= Date.parse(e.at)),
  ).toBe(true);
  expect(timeline.filter((e) => e.source.includes('Walrus'))).toHaveLength(0);
  await expect(supplierTimeline(f.outsider.id, f.invoice.vendorId)).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});
it('enforces distinct verifier in the database as well as the API', async () => {
  const f = await fixture();
  await expect(
    (await db())
      .update(s.supplierChanges)
      .set({ checkedBy: f.requester.id })
      .where(eq(s.supplierChanges.id, f.proposal.id)),
  ).rejects.toThrow();
});
it('deduplicates documents and invoices, requires source review and never trusts the extracted destination', async () => {
  const f = await fixture();
  const bytes = Buffer.from(
    'Supplier: ' +
      f.invoice.vendor +
      '\nInvoice: DOC-' +
      f.id +
      '\nIssued: 2026-11-05\nDue: 2026-12-01\nAmount: 10.00\nCurrency: USD\nRecipient: ' +
      b,
  );
  const doc = await createDocument(f.root.id, f.requester.id, bytes, 'invoice.txt', {
    organizationId: f.org.id,
  });
  expect(doc.retained).toBe(false);
  expect(doc.supplierMatches[0].establishedRecipient).toBe(a);
  await expect(
    createDocument(f.root.id, f.requester.id, bytes, 'invoice.txt', { organizationId: f.org.id }),
  ).rejects.toMatchObject({ code: 'DUPLICATE_DOCUMENT' });
  await expect(readDocument(f.outsider.id, doc.documentId)).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
  const input = {
    ...f.input,
    number: 'DOC-' + f.id,
    importKey: randomUUID(),
    source: 'txt' as const,
    documentId: doc.documentId,
  };
  await expect(saveInvoice(f.root.id, input, undefined, f.requester.id)).rejects.toMatchObject({
    code: 'EXTRACTION_CONFIRMATION',
  });
  const invoiceId = await saveInvoice(
    f.root.id,
    { ...input, confirmExtraction: true },
    undefined,
    f.requester.id,
  );
  expect(
    (await trustContext(f.root.id, await ownedInvoice(f.root.id, invoiceId))).gate.allowed,
  ).toBe(false);
  await deleteDocument(f.root.id, doc.documentId, f.requester.id);
  await expect(readDocument(f.root.id, doc.documentId)).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
  expect((await ownedInvoice(f.root.id, invoiceId)).number).toBe(input.number);
});

it('rejects lookalike supplier matching and bounds document processing before another draft is stored', async () => {
  const f = await fixture();
  for (let n = 0; n < 20; n++) {
    const doc = await createDocument(
      f.root.id,
      f.requester.id,
      Buffer.from('Supplier: ' + f.invoice.vendor + ' Counterfeit\nInvoice: LIMIT-' + n),
      'review-' + n + '.txt',
      { organizationId: f.org.id },
    );
    expect(doc.supplierMatches).toEqual([]);
  }
  await expect(
    createDocument(f.root.id, f.requester.id, Buffer.from('Supplier: More'), 'overflow.txt', {
      organizationId: f.org.id,
    }),
  ).rejects.toMatchObject({ status: 429, code: 'RATE_LIMIT' });
  const state = await businessSnapshot(f.org.id, f.root.id);
  expect(state.documents).toHaveLength(20);
  expect(state.documents.every((d) => d.status === 'review')).toBe(true);
  expect(state.invoices).toHaveLength(1);
  expect(state.profiles[0].trustedRecipient).toBe(a);
});

it('BUS-13 excludes foreign tenant memory even when the provider returns its exact text and blob', async () => {
  const f = await fixture();
  const ownerPolicyId = randomUUID(),
    otherPolicyId = randomUUID();
  for (const [tenantId, policyId, blob] of [
    [f.root.id, ownerPolicyId, 'SYNTHETIC-OWNER-BLOB'],
    [f.outsider.id, otherPolicyId, 'SYNTHETIC-OTHER-BLOB'],
  ]) {
    await (await db()).insert(s.userRules).values({
      id: policyId,
      tenantId,
      policy: {
        id: policyId,
        vendorId: null,
        kind: 'verify_address',
        text: 'Synthetic namespace isolation fixture',
        hard: false,
        isDemo: true,
        scope: 'all',
        active: true,
      },
    });
    await (await db()).insert(s.memoryJobs).values({
      tenantId,
      policyId,
      operationKey: randomUUID(),
      namespace: namespaceFor(tenantId),
      intent: 'Synthetic provenance test',
      text: 'SYNTHETIC exact ' + blob,
      blobId: blob,
      jobId: 'SYNTHETIC-JOB-' + policyId,
      status: 'confirmed',
      isDemo: true,
    });
  }
  memoryMock.recall.mockResolvedValue({
    results: [
      {
        blob_id: 'SYNTHETIC-OWNER-BLOB',
        text: 'SYNTHETIC exact SYNTHETIC-OWNER-BLOB',
        distance: 0,
      },
    ],
    dropped_count: 0,
  });
  vi.stubEnv('DATABASE_URL', 'synthetic-test-flag-not-a-connection');
  vi.stubEnv('MEMWAL_PRIVATE_KEY', 'synthetic-provider-mocked');
  vi.stubEnv('MEMWAL_ACCOUNT_ID', 'synthetic-provider-mocked');
  try {
    const result = await recallMemories(f.outsider.id, 'Synthetic BUS-13 cross-tenant policy');
    expect(result.citations).toHaveLength(0);
    expect(memoryMock.recall).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: namespaceFor(f.outsider.id) }),
    );
  } finally {
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('MEMWAL_PRIVATE_KEY', '');
    vi.stubEnv('MEMWAL_ACCOUNT_ID', '');
  }
});
it('timeline distinguishes stored Walrus proof, retrieval and actual application without inventing influence', async () => {
  const f = await fixture(),
    policyId = randomUUID();
  await (await db()).insert(s.userRules).values({
    id: policyId,
    tenantId: f.root.id,
    vendorId: f.invoice.vendorId,
    policy: {
      id: policyId,
      vendorId: f.invoice.vendorId,
      kind: 'verify_address',
      text: 'Synthetic provenance policy',
      hard: false,
      isDemo: true,
      scope: 'vendor',
      active: false,
      supersededBy: 'SYNTHETIC-NEWER-POLICY',
    },
  });
  const [job] = await (
    await db()
  )
    .insert(s.memoryJobs)
    .values({
      tenantId: f.root.id,
      invoiceId: f.id,
      policyId,
      operationKey: randomUUID(),
      namespace: namespaceFor(f.root.id),
      intent: 'Synthetic timeline fixture; not live Mainnet proof',
      text: 'Synthetic fixture policy',
      blobId: 'SYNTHETIC-BLOB',
      jobId: 'SYNTHETIC-JOB',
      status: 'confirmed',
      isDemo: true,
      completedAt: new Date(),
    })
    .returning();
  await (await db()).insert(s.memoryRecallEvents).values({
    tenantId: f.root.id,
    invoiceId: f.id,
    query: 'Synthetic recall',
    memoryIds: [job.id],
    status: 'recalled',
  });
  let item = (await supplierTimeline(f.root.id, f.invoice.vendorId)).find(
    (e) => e.id === 'memory:' + job.id,
  )!;
  expect(item.status).toBe('superseded');
  expect(item.evidence.influencedDecision).toBe(false);
  expect(item.evidence.returnedAt).toHaveLength(1);
  await (await db()).insert(s.auditEvents).values({
    tenantId: f.root.id,
    type: 'review.evaluated',
    entityId: f.id,
    detail: { actorId: f.verifier.id, usedMemoryIds: [job.id] },
  });
  item = (await supplierTimeline(f.root.id, f.invoice.vendorId)).find(
    (e) => e.id === 'memory:' + job.id,
  )!;
  expect(item.evidence.influencedDecision).toBe(true);
  expect(item.evidence.appliedAt).toHaveLength(1);
});

it('expires private source access and purges only expired drafts while retaining invoices and audits', async () => {
  const f = await fixture();
  const doc = await createDocument(
    f.root.id,
    f.requester.id,
    Buffer.from('Supplier: Synthetic retention fixture\nInvoice: RETENTION-1'),
    'retention.txt',
    { organizationId: f.org.id },
  );
  await (
    await db()
  )
    .update(s.intakeDocuments)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(s.intakeDocuments.id, doc.documentId));
  await expect(readDocument(f.root.id, doc.documentId)).rejects.toMatchObject({
    code: 'DOCUMENT_EXPIRED',
  });
  const result = await purgeExpiredDocuments();
  expect(result.deleted).toBeGreaterThanOrEqual(1);
  await expect(readDocument(f.root.id, doc.documentId)).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
  expect((await ownedInvoice(f.root.id, f.id)).id).toBe(f.id);
  const events = await (
    await db()
  )
    .select()
    .from(s.auditEvents)
    .where(
      and(
        eq(s.auditEvents.entityId, doc.documentId),
        eq(s.auditEvents.type, 'intake.retention_purged'),
      ),
    );
  expect(events).toHaveLength(1);
});
