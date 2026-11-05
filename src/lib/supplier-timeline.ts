import 'server-only';
import { and, eq, inArray, desc } from 'drizzle-orm';
import { db } from '@/db';
import * as s from '@/db/schema';
import { AppError } from './errors';
import type { TimelineEvent } from './business-types';
export async function supplierTimeline(
  tenantId: string,
  vendorId: string,
): Promise<TimelineEvent[]> {
  const d = await db();
  const [vendor] = await d
    .select()
    .from(s.vendors)
    .where(and(eq(s.vendors.id, vendorId), eq(s.vendors.tenantId, tenantId)));
  if (!vendor) throw new AppError(404, 'NOT_FOUND', 'Supplier not found.');
  const invoices = await d
    .select({ id: s.invoices.id, number: s.invoices.number })
    .from(s.invoices)
    .where(and(eq(s.invoices.tenantId, tenantId), eq(s.invoices.vendorId, vendorId)));
  const ids = [vendorId, ...invoices.map((i) => i.id)];
  const [audits, jobs, policies, recalls] = await Promise.all([
    d
      .select()
      .from(s.auditEvents)
      .where(and(eq(s.auditEvents.tenantId, tenantId), inArray(s.auditEvents.entityId, ids)))
      .orderBy(desc(s.auditEvents.createdAt))
      .limit(300),
    d.select().from(s.memoryJobs).where(eq(s.memoryJobs.tenantId, tenantId)),
    d
      .select()
      .from(s.userRules)
      .where(and(eq(s.userRules.tenantId, tenantId), eq(s.userRules.vendorId, vendorId))),
    invoices.length
      ? d
          .select()
          .from(s.memoryRecallEvents)
          .where(
            and(
              eq(s.memoryRecallEvents.tenantId, tenantId),
              inArray(
                s.memoryRecallEvents.invoiceId,
                invoices.map((i) => i.id),
              ),
            ),
          )
          .orderBy(desc(s.memoryRecallEvents.createdAt))
          .limit(100)
      : [],
  ]);
  const result: TimelineEvent[] = audits
    .filter((e) => !e.type.startsWith('service.') && !e.type.startsWith('wallet.'))
    .map((e) => {
      const detail = e.detail;
      const category =
        e.type.includes('memory') || e.type === 'review.correction'
          ? 'memory'
          : e.type.includes('invalidated')
            ? 'pending'
            : e.type.includes('human_verified') ||
                e.type.includes('business.change_') ||
                e.type.startsWith('review.')
              ? 'verification'
              : e.type.startsWith('vendor.') || e.type === 'instructions.updated'
                ? 'recipient'
                : 'all';
      const summary: Record<string, string> = {
        'vendor.created': 'Supplier created',
        'vendor.trust_updated': 'Established payment reference updated',
        'invoice.imported': 'Invoice received',
        'invoice.edited': 'Invoice edited',
        'instructions.updated': 'Payment instructions updated',
        'instructions.human_verified': 'Independent human verification recorded',
        'review.correction': 'Review correction recorded',
        'review.evaluated': 'Invoice review evaluated',
        'review.override': 'Invoice decision recorded',
        'business.change_proposed': 'Payment change proposed',
        'business.change_approved': 'Payment change approved by a distinct verifier',
        'business.change_rejected': 'Payment change rejected',
        'business.change_clarification': 'Clarification requested',
        'business.approval_invalidated': 'Prior approval or proposal invalidated',
      };
      return {
        id: e.id,
        at: e.createdAt.toISOString(),
        source: 'Database audit',
        category,
        title: summary[e.type] || e.type,
        actor:
          typeof detail.actorId === 'string'
            ? detail.actorId
            : 'Not recorded in historical evidence',
        invoice: invoices.find((i) => i.id === e.entityId)?.number || null,
        status: String(
          detail.outcome ||
            detail.status ||
            (e.type.endsWith('_proposed')
              ? 'pending'
              : e.type.includes('invalidated')
                ? 'invalidated'
                : 'recorded'),
        ),
        evidence: detail,
      };
    });
  if (!audits.some((e) => e.type === 'vendor.created'))
    result.push({
      id: 'supplier-row:' + vendor.id,
      at: vendor.createdAt.toISOString(),
      source: 'Supplier record timestamp',
      category: 'all',
      title: 'Supplier record created',
      actor: 'Not recorded in historical evidence',
      invoice: null,
      status: 'recorded',
      evidence: {
        note: 'Creation time comes from the retained row; no historical creator or verification is inferred.',
      },
    });
  for (const job of jobs.filter((j) => policies.some((p) => p.id === j.policyId))) {
    const policy = policies.find((p) => p.id === job.policyId)!.policy;
    const state = policy.supersededBy
      ? 'superseded'
      : policy.active === false
        ? 'inactive'
        : policy.expiresAt && Date.parse(policy.expiresAt) <= Date.now()
          ? 'expired'
          : 'current';
    const returned = recalls.filter((r) => r.memoryIds.includes(job.id));
    const applied = audits.filter(
      (e) =>
        e.type === 'review.evaluated' &&
        Array.isArray(e.detail.usedMemoryIds) &&
        e.detail.usedMemoryIds.includes(job.id),
    );
    result.push({
      id: 'memory:' + job.id,
      at: (job.completedAt || job.createdAt).toISOString(),
      source:
        job.status === 'confirmed' && job.blobId
          ? 'Walrus Mainnet confirmation record'
          : 'Database memory job; not confirmed Mainnet',
      category: 'memory',
      title: policy.text,
      actor: 'See original correction audit; no actor inferred',
      invoice: invoices.find((i) => i.id === job.invoiceId)?.number || null,
      status: state,
      evidence: {
        memoryId: job.id,
        jobId: job.jobId,
        blobId: job.status === 'confirmed' ? job.blobId : null,
        namespace: job.namespace,
        persistedJobStatus: job.status,
        policyId: policy.id,
        supersededBy: policy.supersededBy || null,
        expiresAt: policy.expiresAt || null,
        returnedAt: returned.map((r) => r.createdAt.toISOString()),
        appliedAt: applied.map((e) => e.createdAt.toISOString()),
        influencedDecision: applied.length > 0,
        confirmationBoundary:
          'Stored completion evidence; this timeline does not recheck current provider availability.',
        distinction:
          'Retrieval is distinct from application; influence is asserted only from retained review.evaluated evidence.',
      },
    });
  }
  return result.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id));
}
