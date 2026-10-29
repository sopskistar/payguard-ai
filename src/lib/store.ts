import 'server-only';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db, storageKind, databaseConfigured, type Database } from '@/db';
import * as s from '@/db/schema';
import { DEFAULT_PREFERENCES, type Invoice, type Policy, type Snapshot } from './types';
import { demoInvoices, demoProfiles, OWNER_ID } from './demo';
import { evaluate } from './risk';
import { AppError } from './errors';
import { invoiceInput } from './validation';
import { z } from 'zod';
import { listTrust, trustContext } from './verify-store';
import { instructionSignals } from './verify';
export async function audit(
  tenantId: string,
  type: string,
  entityId: string | null,
  detail: Record<string, unknown>,
  conn?: Database,
) {
  await (conn || (await db())).insert(s.auditEvents).values({ tenantId, type, entityId, detail });
}
export async function listInvoices(tenantId: string): Promise<Invoice[]> {
  const rows = await (
    await db()
  )
    .select({ invoice: s.invoices, vendor: s.vendors.name })
    .from(s.invoices)
    .innerJoin(s.vendors, eq(s.vendors.id, s.invoices.vendorId))
    .where(eq(s.invoices.tenantId, tenantId))
    .orderBy(desc(s.invoices.createdAt));
  return rows.map(({ invoice: i, vendor }) => ({
    ...i,
    vendor,
    createdAt: i.createdAt.toISOString(),
    status: i.status as Invoice['status'],
    source: i.source as Invoice['source'],
  }));
}
export async function ownedInvoice(tenantId: string, id: string) {
  const invoice = (await listInvoices(tenantId)).find((i) => i.id === id);
  if (!invoice) throw new AppError(404, 'NOT_FOUND', 'Invoice not found.');
  return invoice;
}
export async function preferences(tenantId: string) {
  const [u] = await (await db()).select().from(s.users).where(eq(s.users.id, tenantId));
  if (!u) throw new AppError(401, 'AUTH_REQUIRED', 'Workspace not found.');
  return u.settings;
}
export async function policies(tenantId: string): Promise<Policy[]> {
  return (
    await (await db()).select().from(s.userRules).where(eq(s.userRules.tenantId, tenantId))
  ).map((r) => r.policy);
}
export async function saveInvoice(
  tenantId: string,
  input: z.infer<typeof invoiceInput>,
  id?: string,
) {
  const d = await db();
  if (id) {
    const current = await ownedInvoice(tenantId, id);
    if (current.status !== 'open')
      throw new AppError(
        409,
        'LOCKED',
        'Reopen the invoice before editing. Paid invoices cannot be edited.',
      );
  }
  return d.transaction(async (tx) => {
    if (id) {
      const [locked] = await tx
        .select()
        .from(s.invoices)
        .where(and(eq(s.invoices.id, id), eq(s.invoices.tenantId, tenantId)))
        .for('update');
      if (!locked || locked.status !== 'open')
        throw new AppError(409, 'LOCKED', 'The invoice is no longer open for editing.');
    }
    const existing = await tx
      .select()
      .from(s.invoices)
      .where(and(eq(s.invoices.tenantId, tenantId), eq(s.invoices.importKey, input.importKey)))
      .limit(1);
    if (existing[0] && !id) return existing[0].id;
    const [vendor] = await tx
      .insert(s.vendors)
      .values({
        tenantId,
        name: input.vendor,
        normalizedName: input.vendor.toLowerCase().trim(),
        isDemo: input.isDemo,
      })
      .onConflictDoUpdate({
        target: [s.vendors.tenantId, s.vendors.normalizedName, s.vendors.isDemo],
        set: { name: input.vendor },
      })
      .returning();
    const data = {
      tenantId,
      vendorId: vendor.id,
      number: input.number,
      issued: input.issued,
      due: input.due,
      amount: input.amount,
      currency: input.currency,
      memo: input.memo,
      recipient: input.recipient,
      wallet: input.wallet,
      coinType: input.coinType,
      tokenAmount: input.tokenAmount,
      source: input.source,
      isDemo: input.isDemo,
      importKey: input.importKey,
      updatedAt: new Date(),
    };
    let invoiceId = id;
    if (id)
      await tx
        .update(s.invoices)
        .set(data)
        .where(and(eq(s.invoices.id, id), eq(s.invoices.tenantId, tenantId)));
    else {
      const [row] = await tx.insert(s.invoices).values(data).returning();
      invoiceId = row.id;
    }
    if (input.extraction)
      await tx.insert(s.invoiceFiles).values({
        tenantId,
        invoiceId: invoiceId!,
        filename: input.extraction.filename,
        sha256: input.extraction.sha256,
        size: input.extraction.size,
        outcome: input.extraction.outcome,
        metadata: input.extraction.fields,
      });
    await tx.insert(s.auditEvents).values({
      tenantId,
      type: id ? 'invoice.edited' : 'invoice.imported',
      entityId: invoiceId,
      detail: { source: input.source, isDemo: input.isDemo },
    });
    return invoiceId!;
  });
}
export async function changeStatus(
  tenantId: string,
  id: string,
  status: 'open' | 'approved' | 'rejected' | 'escalated',
  reason: string,
) {
  await (
    await db()
  ).transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(s.invoices)
      .where(and(eq(s.invoices.tenantId, tenantId), eq(s.invoices.id, id)))
      .for('update');
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Invoice not found.');
    const [vendor] = await tx
      .select()
      .from(s.vendors)
      .where(eq(s.vendors.id, row.vendorId))
      .for('update');
    if (status === 'approved') {
      const invoice = {
        ...row,
        vendor: vendor.name,
        createdAt: row.createdAt.toISOString(),
      } as Invoice;
      const context = await trustContext(tenantId, invoice, tx as unknown as Database);
      if (!context.gate.allowed) throw new AppError(409, 'VERIFY_REQUIRED', context.gate.reason);
    }
    const [changed] = await tx
      .update(s.invoices)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(s.invoices.tenantId, tenantId),
          eq(s.invoices.id, id),
          inArray(s.invoices.status, ['open', 'approved', 'rejected', 'escalated']),
        ),
      )
      .returning();
    if (!changed)
      throw new AppError(409, 'PAID_LOCK', 'Verified paid invoices cannot be manually reopened.');
    await tx.insert(s.reviewDecisions).values({
      tenantId,
      invoiceId: id,
      action: status,
      findingId: 'manual-status',
      explanation: reason,
      scope: 'invoice',
      future: false,
    });
    await tx
      .insert(s.auditEvents)
      .values({ tenantId, type: 'review.override', entityId: id, detail: { status, reason } });
  });
}
export async function deleteInvoice(tenantId: string, id: string) {
  await ownedInvoice(tenantId, id);
  const d = await db();
  const matches = await d
    .select()
    .from(s.paymentMatches)
    .where(and(eq(s.paymentMatches.tenantId, tenantId), eq(s.paymentMatches.invoiceId, id)));
  if (matches.length)
    throw new AppError(
      409,
      'PAID_LOCK',
      'Invoices with confirmed payment evidence are retained for audit.',
    );
  await d.transaction(async (tx) => {
    await tx
      .delete(s.invoices)
      .where(and(eq(s.invoices.tenantId, tenantId), eq(s.invoices.id, id)));
    await tx.insert(s.auditEvents).values({
      tenantId,
      type: 'invoice.deleted',
      entityId: id,
      detail: { retention: 'Review decisions, memory and audit history retained.' },
    });
  });
}
export async function seedDemo(tenantId = OWNER_ID) {
  const d = await db();
  await d
    .insert(s.users)
    .values({
      id: tenantId,
      name: 'Workspace owner',
      role: tenantId === OWNER_ID ? 'owner' : 'member',
      settings: DEFAULT_PREFERENCES,
    })
    .onConflictDoNothing();
  for (const invoice of demoInvoices()) {
    const normalized = invoice.vendor.toLowerCase();
    const [v] = await d
      .insert(s.vendors)
      .values({ tenantId, name: invoice.vendor, normalizedName: normalized, isDemo: true })
      .onConflictDoUpdate({
        target: [s.vendors.tenantId, s.vendors.normalizedName, s.vendors.isDemo],
        set: { name: invoice.vendor },
      })
      .returning();
    const { vendor: _vendor, createdAt: _createdAt, ...data } = invoice;
    void _vendor;
    void _createdAt;
    await d
      .insert(s.invoices)
      .values({
        ...data,
        id: randomUUID(),
        tenantId,
        vendorId: v.id,
        importKey: `sample-${invoice.id}`,
        createdAt: new Date(invoice.createdAt),
      })
      .onConflictDoNothing();
  }
  for (const profile of demoProfiles()) {
    const [vendor] = await d
      .select()
      .from(s.vendors)
      .where(
        and(
          eq(s.vendors.tenantId, tenantId),
          eq(s.vendors.normalizedName, profile.name.toLowerCase()),
          eq(s.vendors.isDemo, true),
        ),
      );
    if (vendor)
      await d
        .insert(s.vendorTrustProfiles)
        .values({
          tenantId,
          vendorId: vendor.id,
          trustedRecipient: profile.trustedRecipient,
          emailDomain: profile.emailDomain,
          contactLabel: profile.contactLabel,
          contactMethod: profile.contactMethod,
          contactReference: profile.contactReference,
          establishedAt: new Date(profile.establishedAt),
        })
        .onConflictDoNothing();
  }
  await d
    .insert(s.demoScenarios)
    .values({ tenantId, key: 'samples-v1', state: { loaded: true } })
    .onConflictDoNothing();
  await audit(tenantId, 'demo.samples_loaded', null, { synthetic: true });
}
export async function resetDemo(tenantId: string) {
  const items = (await listInvoices(tenantId)).filter((i) => i.isDemo);
  const matches = await (
    await db()
  )
    .select()
    .from(s.paymentMatches)
    .where(eq(s.paymentMatches.tenantId, tenantId));
  for (const i of items)
    if (!matches.some((m) => m.invoiceId === i.id)) await deleteInvoice(tenantId, i.id);
  await audit(tenantId, 'demo.samples_reset', null, {
    retained:
      'Walrus memories, rules and audit events are retained. Verified paid samples are retained.',
  });
}
export async function snapshot(tenantId: string): Promise<Snapshot> {
  const d = await db();
  const vendorProfiles = await listTrust(tenantId);
  const [invoices, prefs, rules, jobs, wallets, events, matches] = await Promise.all([
    listInvoices(tenantId),
    preferences(tenantId),
    policies(tenantId),
    d
      .select()
      .from(s.memoryJobs)
      .where(eq(s.memoryJobs.tenantId, tenantId))
      .orderBy(desc(s.memoryJobs.createdAt)),
    d.select().from(s.watchedWallets).where(eq(s.watchedWallets.tenantId, tenantId)),
    d
      .select()
      .from(s.auditEvents)
      .where(eq(s.auditEvents.tenantId, tenantId))
      .orderBy(desc(s.auditEvents.createdAt))
      .limit(100),
    d.select().from(s.paymentMatches).where(eq(s.paymentMatches.tenantId, tenantId)),
  ]);
  const [identity] = await d.select().from(s.users).where(eq(s.users.id, tenantId));
  const supplierList = await d
    .select({ id: s.vendors.id, name: s.vendors.name, isDemo: s.vendors.isDemo })
    .from(s.vendors)
    .where(eq(s.vendors.tenantId, tenantId));
  return {
    mode: identity.role === 'owner' ? 'owner' : 'member',
    identity: { walletAddress: identity.walletAddress },
    vendors: supplierList,
    storage: storageKind(),
    vendorProfiles,
    invoices,
    assessments: Object.fromEntries(
      invoices.map((i) => [
        i.id,
        evaluate(
          i,
          invoices,
          prefs,
          rules,
          [],
          'Recheck to retrieve Walrus memories',
          new Date(),
          instructionSignals(
            i,
            vendorProfiles.find((p) => p.vendorId === i.vendorId),
          ),
          vendorProfiles.find((p) => p.vendorId === i.vendorId)?.trustedRecipient,
        ),
      ]),
    ),
    preferences: prefs,
    memories: jobs.map((j) => ({
      ...j,
      createdAt: j.createdAt.toISOString(),
      completedAt: j.completedAt?.toISOString() ?? null,
    })),
    wallets: wallets.map((w) => ({ ...w, refreshedAt: w.refreshedAt?.toISOString() ?? null })),
    audit: events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
    integrations: {
      database: databaseConfigured(),
      memory: !!(
        process.env.DATABASE_URL &&
        process.env.MEMWAL_PRIVATE_KEY &&
        process.env.MEMWAL_ACCOUNT_ID
      ),
      tatum: !!process.env.TATUM_API_KEY,
    },
    confirmedPayments: matches.length,
    accountId: identity.role === 'owner' ? process.env.MEMWAL_ACCOUNT_ID : undefined,
    usedMemoryIds: [
      ...new Set(
        events
          .filter((e) => e.type === 'review.evaluated')
          .flatMap((e) =>
            Array.isArray(e.detail.usedMemoryIds)
              ? e.detail.usedMemoryIds.filter((id): id is string => typeof id === 'string')
              : [],
          ),
      ),
    ],
  };
}
