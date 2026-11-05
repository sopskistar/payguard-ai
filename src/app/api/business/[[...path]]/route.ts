import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db, withDatabaseRequest } from '@/db';
import * as s from '@/db/schema';
import { requireWorkspace, checkOrigin, rateLimit } from '@/lib/auth';
import { businessAccess, REQUEST_ROLES } from '@/lib/organization-access';
import {
  businessList,
  businessSnapshot,
  createOrganization,
  createOrganizationInput,
  updateMember,
  memberInput,
  proposeChange,
  changeInput,
  decideChange,
  decisionInput,
} from '@/lib/business';
import { saveInvoice, ownedInvoice } from '@/lib/store';
import { invoiceInput } from '@/lib/validation';
import { saveInstructions, instructionInput, trustContext } from '@/lib/verify-store';
import { assess } from '@/lib/integrations/memory';
import { supplierTimeline } from '@/lib/supplier-timeline';
import { createDocument, readDocument, documentPreview, deleteDocument } from '@/lib/documents';
import { inboundConfiguration, ensureInboundRoute } from '@/lib/inbound-email';
import { privateJson, businessFailure, businessBody, uploadedFile } from '@/lib/business-http';
import { AppError } from '@/lib/errors';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
async function handle(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  try {
    if (req.method !== 'GET') checkOrigin(req);
    const actor = await requireWorkspace();
    const actorId = actor.tenantId;
    const path = (await params).path || [];
    if (req.method !== 'GET') await rateLimit(actorId + ':business', 120);
    if (!path.length) {
      if (req.method === 'GET') return privateJson(await businessList(actorId));
      if (req.method === 'POST')
        return privateJson(
          await createOrganization(actorId, createOrganizationInput.parse(await businessBody(req))),
          201,
        );
    }
    const orgId = z.string().uuid().parse(path[0]);
    if (path.length === 1 && req.method === 'GET')
      return privateJson(await businessSnapshot(orgId, actorId));
    const c = await businessAccess(orgId, actorId);
    if (path[1] === 'members' && path.length === 2 && req.method === 'POST')
      return privateJson(
        await updateMember(orgId, actorId, memberInput.parse(await businessBody(req))),
      );
    if (path[1] === 'timeline' && req.method === 'GET')
      return privateJson(
        await supplierTimeline(
          c.tenantId,
          z.string().uuid().parse(req.nextUrl.searchParams.get('vendorId')),
        ),
      );
    if (path[1] === 'context' && req.method === 'POST') {
      const input = z
        .object({ invoiceId: z.string().uuid() })
        .strict()
        .parse(await businessBody(req));
      return privateJson(
        await trustContext(c.tenantId, await ownedInvoice(c.tenantId, input.invoiceId)),
      );
    }
    if (path[1] === 'extract' && req.method === 'POST') {
      await businessAccess(orgId, actorId, REQUEST_ROLES);
      await rateLimit(c.tenantId + ':uploads', 20);
      const file = await uploadedFile(req);
      return privateJson(
        await createDocument(
          c.tenantId,
          actorId,
          new Uint8Array(await file.arrayBuffer()),
          file.name,
          { organizationId: orgId },
        ),
      );
    }
    if (path[1] === 'invoices' && ['POST', 'PATCH'].includes(req.method)) {
      await businessAccess(orgId, actorId, REQUEST_ROLES);
      const id = path[2] ? z.string().uuid().parse(path[2]) : undefined;
      return privateJson(
        {
          id: await saveInvoice(
            c.tenantId,
            invoiceInput.parse(await businessBody(req)),
            id,
            actorId,
          ),
        },
        id ? 200 : 201,
      );
    }
    if (path[1] === 'instructions' && req.method === 'POST') {
      await businessAccess(orgId, actorId, REQUEST_ROLES);
      await saveInstructions(c.tenantId, instructionInput.parse(await businessBody(req)), actorId);
      return privateJson({ ok: true });
    }
    if (path[1] === 'proposals' && path.length === 2 && req.method === 'POST')
      return privateJson(
        await proposeChange(orgId, actorId, changeInput.parse(await businessBody(req))),
        201,
      );
    if (
      path[1] === 'proposals' &&
      path.length === 4 &&
      path[3] === 'decision' &&
      req.method === 'POST'
    )
      return privateJson(
        await decideChange(
          orgId,
          actorId,
          z.string().uuid().parse(path[2]),
          decisionInput.parse(await businessBody(req)),
        ),
      );
    if (path[1] === 'review' && req.method === 'POST') {
      const input = z
        .object({ invoiceId: z.string().uuid(), memoryOn: z.boolean() })
        .strict()
        .parse(await businessBody(req));
      await ownedInvoice(c.tenantId, input.invoiceId);
      return privateJson(await assess(c.tenantId, input.invoiceId, input.memoryOn, actorId));
    }
    if (path[1] === 'forwarding') {
      if (req.method === 'GET')
        return privateJson({
          configuration: inboundConfiguration(),
          route: await ensureInboundRoute(c.tenantId, orgId, false),
        });
      if (req.method === 'POST') {
        await businessAccess(orgId, actorId, ['admin']);
        return privateJson({
          configuration: inboundConfiguration(),
          route: await ensureInboundRoute(c.tenantId, orgId, true),
        });
      }
    }
    if (path[1] === 'documents' && path[2]) {
      const id = z.string().uuid().parse(path[2]);
      if (req.method === 'GET') {
        if (path[3] === 'preview')
          return new Response(await documentPreview(c.tenantId, id), {
            headers: {
              'Content-Type': 'image/jpeg',
              'Cache-Control': 'private, no-store',
              'X-Content-Type-Options': 'nosniff',
            },
          });
        const row = await readDocument(c.tenantId, id);
        return privateJson({
          id: row.id,
          filename: row.filename,
          extraction: row.extraction,
          status: row.status,
          retained: !!row.objectPath,
          previewUrl:
            row.objectPath && (row.mime.startsWith('image/') || row.mime === 'application/pdf')
              ? '/api/business/' + orgId + '/documents/' + id + '/preview'
              : null,
        });
      }
      if (req.method === 'DELETE') {
        await businessAccess(orgId, actorId, REQUEST_ROLES);
        return privateJson(await deleteDocument(c.tenantId, id, actorId));
      }
    }
    if (path[1] === 'learning' && req.method === 'POST') {
      const input = z
        .object({
          invoiceId: z.string().uuid(),
          summary: z.string().trim().min(12).max(500),
          confirmMinimized: z.literal(true),
        })
        .strict()
        .parse(await businessBody(req));
      const context = await trustContext(
        c.tenantId,
        await ownedInvoice(c.tenantId, input.invoiceId),
      );
      if (!context.gate.allowed)
        throw new AppError(
          409,
          'VERIFICATION_REQUIRED',
          'Only a currently verified proposal can become a learning candidate.',
        );
      await (await db()).insert(s.auditEvents).values({
        tenantId: c.tenantId,
        type: 'business.learning_proposed',
        entityId: input.invoiceId,
        detail: {
          actorId,
          summary: input.summary,
          consentToReview: true,
          providerWrite: false,
          namespaceOwner: c.tenantId,
        },
      });
      return privateJson({
        status: 'proposed',
        providerWrite: false,
        message:
          'Saved for workspace-owner review. No Walrus write occurred. A separate minimized-content and cost approval is required.',
      });
    }
    throw new AppError(404, 'NOT_FOUND', 'Business action not found.');
  } catch (error) {
    return businessFailure(error);
  }
}
const scoped: typeof handle = (req, ctx) => withDatabaseRequest(() => handle(req, ctx));
export const GET = scoped;
export const POST = scoped;
export const PATCH = scoped;
export const DELETE = scoped;
