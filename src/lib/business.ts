import 'server-only';
import { and, eq, isNull, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db, type Database } from '@/db';
import * as s from '@/db/schema';
import { AppError } from './errors';
import { address } from './validation';
import { profileInput, trustContext } from './verify-store';
import { listInvoices } from './store';
import { listTrust } from './verify-store';
import {
  businessAccess,
  VERIFY_ROLES,
  REQUEST_ROLES,
  invalidateBusinessApprovals,
} from './organization-access';
import type { Invoice } from './types';
export const createOrganizationInput = z
  .object({ name: z.string().trim().min(2).max(100), confirmWorkspaceSharing: z.literal(true) })
  .strict();
export const memberInput = z
  .object({
    wallet: address,
    role: z.enum(['admin', 'requester', 'verifier']),
    revoke: z.boolean().default(false),
  })
  .strict();
export const changeInput = z
  .object({
    invoiceId: z.string().uuid(),
    operationKey: z.string().uuid(),
    note: z.string().trim().min(12).max(1000),
    initialProfile: profileInput.omit({ vendorId: true }).optional(),
  })
  .strict();
export const decisionInput = z
  .object({
    outcome: z.enum(['confirmed', 'rejected', 'clarification']),
    method: z.enum(['phone', 'in_person', 'secure_portal']),
    note: z.string().trim().min(12).max(1000),
    evidenceReference: z.string().trim().min(5).max(180),
    usedEstablishedContact: z.literal(true),
  })
  .strict();
export async function businessList(actorId: string) {
  return (await db())
    .select({
      id: s.organizations.id,
      name: s.organizations.name,
      role: s.organizationMembers.role,
    })
    .from(s.organizations)
    .innerJoin(s.organizationMembers, eq(s.organizationMembers.organizationId, s.organizations.id))
    .where(and(eq(s.organizationMembers.userId, actorId), isNull(s.organizationMembers.revokedAt)));
}
export async function createOrganization(
  actorId: string,
  input: z.infer<typeof createOrganizationInput>,
) {
  return (await db()).transaction(async (tx) => {
    await tx.select({ id: s.users.id }).from(s.users).where(eq(s.users.id, actorId)).for('update');
    const [old] = await tx
      .select()
      .from(s.organizations)
      .where(eq(s.organizations.tenantId, actorId));
    if (old) return { id: old.id };
    const [org] = await tx
      .insert(s.organizations)
      .values({ tenantId: actorId, name: input.name })
      .returning();
    await tx
      .insert(s.organizationMembers)
      .values({ organizationId: org.id, userId: actorId, role: 'admin' });
    await tx.insert(s.auditEvents).values({
      tenantId: actorId,
      type: 'business.created',
      entityId: org.id,
      detail: { actorId, organizationId: org.id, sharingExplicitlyConfirmed: true },
    });
    return { id: org.id };
  });
}
export async function updateMember(
  orgId: string,
  actorId: string,
  input: z.infer<typeof memberInput>,
) {
  return (await db()).transaction(async (tx) => {
    const c = await businessAccess(orgId, actorId, ['admin'], tx as unknown as Database, true);
    const [identity] = await tx
      .select()
      .from(s.users)
      .where(eq(s.users.walletAddress, input.wallet));
    if (!identity || identity.role !== 'member')
      throw new AppError(
        404,
        'IDENTITY_REQUIRED',
        'This wallet must first complete its own normal wallet sign-in. No invitation or account has been fabricated.',
      );
    const rows = await tx
      .select()
      .from(s.organizationMembers)
      .where(eq(s.organizationMembers.organizationId, orgId));
    const old = rows.find((m) => m.userId === identity.id);
    if (
      old?.role === 'admin' &&
      !old.revokedAt &&
      (input.revoke || input.role !== 'admin') &&
      rows.filter((m) => m.role === 'admin' && !m.revokedAt).length === 1
    )
      throw new AppError(409, 'LAST_ADMIN', 'Keep at least one active organization administrator.');
    const values = {
      organizationId: orgId,
      userId: identity.id,
      role: input.role,
      revision: (old?.revision || 0) + 1,
      revokedAt: input.revoke ? new Date() : null,
    };
    await tx
      .insert(s.organizationMembers)
      .values(values)
      .onConflictDoUpdate({
        target: [s.organizationMembers.organizationId, s.organizationMembers.userId],
        set: values,
      });
    await tx.insert(s.auditEvents).values({
      tenantId: c.tenantId,
      type: input.revoke ? 'business.member_revoked' : 'business.member_updated',
      entityId: orgId,
      detail: { actorId, memberId: identity.id, role: input.role, revision: values.revision },
    });
    return { ok: true };
  });
}
export async function businessSnapshot(orgId: string, actorId: string) {
  const c = await businessAccess(orgId, actorId);
  const d = await db();
  const [invoices, profiles, members, changes, documents] = await Promise.all([
    listInvoices(c.tenantId),
    listTrust(c.tenantId),
    d
      .select({
        id: s.users.id,
        name: s.users.name,
        wallet: s.users.walletAddress,
        role: s.organizationMembers.role,
        revokedAt: s.organizationMembers.revokedAt,
      })
      .from(s.organizationMembers)
      .innerJoin(s.users, eq(s.users.id, s.organizationMembers.userId))
      .where(eq(s.organizationMembers.organizationId, orgId)),
    d
      .select()
      .from(s.supplierChanges)
      .where(eq(s.supplierChanges.organizationId, orgId))
      .orderBy(desc(s.supplierChanges.createdAt))
      .limit(100),
    d
      .select({
        id: s.intakeDocuments.id,
        filename: s.intakeDocuments.filename,
        status: s.intakeDocuments.status,
        source: s.intakeDocuments.source,
        createdAt: s.intakeDocuments.createdAt,
        expiresAt: s.intakeDocuments.expiresAt,
        invoiceId: s.intakeDocuments.invoiceId,
      })
      .from(s.intakeDocuments)
      .where(and(eq(s.intakeDocuments.organizationId, orgId), isNull(s.intakeDocuments.deletedAt)))
      .orderBy(desc(s.intakeDocuments.createdAt))
      .limit(50),
  ]);
  return {
    checkedAt: new Date().toISOString(),
    organization: { id: orgId, name: c.organization.name },
    actorId,
    role: c.member.role,
    invoices,
    profiles,
    members,
    changes: changes.map((r) => ({
      ...r,
      expiresAt: r.expiresAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      checkedAt: r.checkedAt?.toISOString() || null,
    })),
    documents,
  };
}
export async function proposeChange(
  orgId: string,
  actorId: string,
  input: z.infer<typeof changeInput>,
) {
  return (await db()).transaction(async (tx) => {
    const c = await businessAccess(orgId, actorId, REQUEST_ROLES, tx as unknown as Database, true);
    const [row] = await tx
      .select()
      .from(s.invoices)
      .where(and(eq(s.invoices.id, input.invoiceId), eq(s.invoices.tenantId, c.tenantId)))
      .for('update');
    if (!row || row.status !== 'open')
      throw new AppError(
        409,
        'OPEN_INVOICE_REQUIRED',
        'Choose an open invoice in this business workspace.',
      );
    const [vendor] = await tx
      .select()
      .from(s.vendors)
      .where(eq(s.vendors.id, row.vendorId))
      .for('update');
    const invoice = {
      ...row,
      vendor: vendor.name,
      createdAt: row.createdAt.toISOString(),
    } as Invoice;
    const context = await trustContext(c.tenantId, invoice, tx as unknown as Database);
    if (!invoice.recipient)
      throw new AppError(
        409,
        'RECIPIENT_REQUIRED',
        'Review and record the proposed payment destination on the invoice first.',
      );
    if (!context.profile && !input.initialProfile)
      throw new AppError(
        409,
        'TRUST_REFERENCE_REQUIRED',
        'Supply an independently sourced initial supplier contact for a separate verifier to check.',
      );
    if (context.profile && input.initialProfile)
      throw new AppError(
        409,
        'ESTABLISHED_CONTACT',
        'Use the existing established contact; new request-supplied contact details cannot replace it.',
      );
    if (input.initialProfile && input.initialProfile.trustedRecipient !== invoice.recipient)
      throw new AppError(
        409,
        'REFERENCE_CONFLICT',
        'The proposed initial reference must match this invoice destination.',
      );
    const [old] = await tx
      .select()
      .from(s.supplierChanges)
      .where(
        and(
          eq(s.supplierChanges.organizationId, orgId),
          eq(s.supplierChanges.operationKey, input.operationKey),
        ),
      );
    if (old) {
      if (old.invoiceId !== invoice.id || old.proposedBy !== actorId)
        throw new AppError(
          409,
          'OPERATION_CONFLICT',
          'This operation belongs to a different request.',
        );
      return old;
    }
    const [proposal] = await tx
      .insert(s.supplierChanges)
      .values({
        tenantId: c.tenantId,
        organizationId: orgId,
        invoiceId: invoice.id,
        vendorId: invoice.vendorId,
        operationKey: input.operationKey,
        proposedBy: actorId,
        previousRecipient: context.profile?.trustedRecipient || '',
        proposedRecipient: invoice.recipient,
        instructionHash: context.instructionHash,
        profileRevision: context.profile?.revision || 0,
        proposedProfile: input.initialProfile as Record<string, unknown> | undefined,
        note: input.note,
        expiresAt: new Date(Date.now() + 30 * 86400000),
      })
      .returning();
    await tx.insert(s.auditEvents).values({
      tenantId: c.tenantId,
      type: 'business.change_proposed',
      entityId: invoice.id,
      detail: {
        organizationId: orgId,
        proposalId: proposal.id,
        actorId,
        previousRecipient: proposal.previousRecipient,
        proposedRecipient: proposal.proposedRecipient,
        profileRevision: proposal.profileRevision,
        instructionHash: proposal.instructionHash,
      },
    });
    return proposal;
  });
}
export async function decideChange(
  orgId: string,
  actorId: string,
  id: string,
  input: z.infer<typeof decisionInput>,
) {
  return (await db()).transaction(async (tx) => {
    const c = await businessAccess(orgId, actorId, VERIFY_ROLES, tx as unknown as Database, true);
    // Read only within the authorized organization, then use the shared lock order.
    let [proposal] = await tx
      .select()
      .from(s.supplierChanges)
      .where(and(eq(s.supplierChanges.id, id), eq(s.supplierChanges.organizationId, orgId)));
    if (!proposal) throw new AppError(404, 'NOT_FOUND', 'Proposal not found.');
    if (proposal.proposedBy === actorId)
      throw new AppError(
        403,
        'SELF_APPROVAL',
        'A different authenticated person must verify this request, regardless of role changes.',
      );
    const [row] = await tx
      .select()
      .from(s.invoices)
      .where(and(eq(s.invoices.id, proposal.invoiceId), eq(s.invoices.tenantId, c.tenantId)))
      .for('update');
    const [vendor] = await tx
      .select()
      .from(s.vendors)
      .where(eq(s.vendors.id, proposal.vendorId))
      .for('update');
    [proposal] = await tx
      .select()
      .from(s.supplierChanges)
      .where(eq(s.supplierChanges.id, id))
      .for('update');
    if (!['pending', 'clarification'].includes(proposal.state) || proposal.expiresAt <= new Date())
      throw new AppError(
        409,
        'PROPOSAL_CLOSED',
        'This request is closed or expired. Preserve it and review the current instructions.',
      );
    if (!row || row.status !== 'open')
      throw new AppError(409, 'INVOICE_CHANGED', 'The invoice is no longer open.');
    const invoice = {
      ...row,
      vendor: vendor.name,
      createdAt: row.createdAt.toISOString(),
    } as Invoice;
    const context = await trustContext(c.tenantId, invoice, tx as unknown as Database);
    if (
      context.instructionHash !== proposal.instructionHash ||
      (context.profile?.revision || 0) !== proposal.profileRevision ||
      invoice.recipient !== proposal.proposedRecipient
    )
      throw new AppError(
        409,
        'STALE_PROPOSAL',
        'Invoice, instructions or reference changed. Review a new proposal.',
      );
    let profile = context.profile;
    if (!profile) {
      const initial = profileInput.parse({ ...proposal.proposedProfile, vendorId: vendor.id });
      profile = { ...initial, name: vendor.name, isDemo: vendor.isDemo, revision: 0 };
    }
    if (
      profile.contactMethod !== input.method ||
      (context.instruction &&
        Date.parse(profile.establishedAt) >= Date.parse(context.instruction.receivedAt))
    )
      throw new AppError(
        409,
        'ESTABLISHED_CONTACT',
        'Use the pre-established independent contact and its recorded channel.',
      );
    const state =
      input.outcome === 'confirmed'
        ? 'approved'
        : input.outcome === 'rejected'
          ? 'rejected'
          : 'clarification';
    let revision = proposal.profileRevision;
    if (input.outcome === 'confirmed') {
      await invalidateBusinessApprovals(
        c.tenantId,
        tx as unknown as Database,
        { vendorId: vendor.id, exceptId: id },
        actorId,
      );
      revision++;
      const values = {
        tenantId: c.tenantId,
        vendorId: vendor.id,
        trustedRecipient: proposal.proposedRecipient,
        emailDomain: profile.emailDomain,
        contactLabel: profile.contactLabel,
        contactMethod: profile.contactMethod,
        contactReference: profile.contactReference,
        establishedAt: new Date(profile.establishedAt),
        revision,
        updatedAt: new Date(),
      };
      await tx
        .insert(s.vendorTrustProfiles)
        .values(values)
        .onConflictDoUpdate({ target: s.vendorTrustProfiles.vendorId, set: values });
      await tx.insert(s.auditEvents).values({
        tenantId: c.tenantId,
        type: 'vendor.trust_updated',
        entityId: vendor.id,
        detail: {
          actorId,
          organizationId: orgId,
          proposalId: id,
          revision,
          priorAttestationsInvalidated: true,
          previousReference: {
            recipient: proposal.previousRecipient,
            revision: proposal.profileRevision,
          },
          currentReference: {
            recipient: proposal.proposedRecipient,
            revision,
            source: 'distinct business verifier attestation',
          },
        },
      });
    }
    if (input.outcome !== 'clarification') {
      const [verification] = await tx
        .insert(s.humanVerifications)
        .values({
          tenantId: c.tenantId,
          invoiceId: invoice.id,
          recipient: invoice.recipient,
          instructionHash: context.instructionHash,
          profileRevision: revision,
          outcome: input.outcome,
          method: input.method,
          note: input.note,
        })
        .returning();
      await tx.insert(s.auditEvents).values({
        tenantId: c.tenantId,
        type: 'instructions.human_verified',
        entityId: invoice.id,
        detail: {
          actorId,
          organizationId: orgId,
          proposalId: id,
          verificationId: verification.id,
          outcome: input.outcome,
          profileRevision: revision,
          source: 'human attestation; not independently observed by the app',
        },
      });
    }
    const [saved] = await tx
      .update(s.supplierChanges)
      .set({
        state,
        checkedBy: actorId,
        checkedAt: new Date(),
        profileRevision: revision,
        expiresAt: new Date(Date.now() + 30 * 86400000),
        decision: {
          ...input,
          identity: actorId,
          humanAssertion: true,
          paymentAuthorization: false,
        },
      })
      .where(eq(s.supplierChanges.id, id))
      .returning();
    await tx.insert(s.auditEvents).values({
      tenantId: c.tenantId,
      type: 'business.change_' + state,
      entityId: invoice.id,
      detail: {
        organizationId: orgId,
        proposalId: id,
        actorId,
        proposedBy: proposal.proposedBy,
        method: input.method,
        note: input.note,
        evidenceReference: input.evidenceReference,
        paymentAuthorization: false,
      },
    });
    return saved;
  });
}
