import 'server-only';
import { and, eq, inArray, isNull, ne } from 'drizzle-orm';
import { db, type Database } from '@/db';
import * as s from '@/db/schema';
import { AppError } from './errors';
export type BusinessRole = 'admin' | 'requester' | 'verifier';
export const REQUEST_ROLES: BusinessRole[] = ['admin', 'requester'];
export const VERIFY_ROLES: BusinessRole[] = ['admin', 'verifier'];

// Each write locks the workspace identity, then organization, then invoice/vendor.
// Membership is read under that lock, never trusted from a session or client claim.
export async function businessAccess(
  organizationId: string,
  actorId: string,
  roles?: BusinessRole[],
  connection?: Database,
  lock = false,
) {
  const d = connection || (await db());
  let [organization] = await d
    .select()
    .from(s.organizations)
    .where(eq(s.organizations.id, organizationId));
  if (!organization) throw new AppError(404, 'NOT_FOUND', 'Business workspace not found.');
  if (lock) {
    await d
      .select({ id: s.users.id })
      .from(s.users)
      .where(eq(s.users.id, organization.tenantId))
      .for('update');
    [organization] = await d
      .select()
      .from(s.organizations)
      .where(eq(s.organizations.id, organizationId))
      .for('update');
  }
  const [member] = await d
    .select()
    .from(s.organizationMembers)
    .where(
      and(
        eq(s.organizationMembers.organizationId, organizationId),
        eq(s.organizationMembers.userId, actorId),
        isNull(s.organizationMembers.revokedAt),
      ),
    );
  if (!member || (roles && !roles.includes(member.role as BusinessRole)))
    throw new AppError(
      403,
      'BUSINESS_ROLE',
      'An active authorized business membership is required.',
    );
  return { organization, member, tenantId: organization.tenantId, actorId };
}
export async function workspaceOrganization(tenantId: string, connection?: Database) {
  const [organization] = await (connection || (await db()))
    .select()
    .from(s.organizations)
    .where(eq(s.organizations.tenantId, tenantId));
  return organization;
}
export async function businessWriteGuard(
  tenantId: string,
  connection: Database,
  actorId = tenantId,
) {
  await connection
    .select({ id: s.users.id })
    .from(s.users)
    .where(eq(s.users.id, tenantId))
    .for('update');
  const organization = await workspaceOrganization(tenantId, connection);
  if (organization) await businessAccess(organization.id, actorId, REQUEST_ROLES, connection, true);
  return organization;
}
export async function invalidateBusinessApprovals(
  tenantId: string,
  connection: Database,
  where: { invoiceId?: string; vendorId?: string; exceptId?: string },
  actorId = tenantId,
) {
  const rows = await connection
    .update(s.supplierChanges)
    .set({ state: 'invalidated' })
    .where(
      and(
        eq(s.supplierChanges.tenantId, tenantId),
        where.invoiceId
          ? eq(s.supplierChanges.invoiceId, where.invoiceId)
          : eq(s.supplierChanges.vendorId, where.vendorId!),
        where.exceptId ? ne(s.supplierChanges.id, where.exceptId) : undefined,
        inArray(s.supplierChanges.state, ['approved', 'pending', 'clarification']),
      ),
    )
    .returning({ id: s.supplierChanges.id, invoiceId: s.supplierChanges.invoiceId });
  for (const row of rows)
    await connection.insert(s.auditEvents).values({
      tenantId,
      type: 'business.approval_invalidated',
      entityId: row.invoiceId,
      detail: {
        proposalId: row.id,
        actorId,
        reason: 'Invoice, instructions or supplier reference changed.',
      },
    });
}
export async function businessApprovalGate(
  tenantId: string,
  invoiceId: string,
  hash: string,
  revision: number | undefined,
  connection?: Database,
) {
  const d = connection || (await db());
  if (!(await workspaceOrganization(tenantId, d))) return true;
  const rows = await d
    .select()
    .from(s.supplierChanges)
    .where(
      and(
        eq(s.supplierChanges.tenantId, tenantId),
        eq(s.supplierChanges.invoiceId, invoiceId),
        eq(s.supplierChanges.state, 'approved'),
      ),
    );
  return rows.some(
    (r) =>
      r.proposedBy !== r.checkedBy &&
      !!r.checkedBy &&
      r.instructionHash === hash &&
      r.profileRevision === revision &&
      r.expiresAt > new Date(),
  );
}
