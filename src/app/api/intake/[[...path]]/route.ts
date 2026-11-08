import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withDatabaseRequest } from '@/db';
import { requireWorkspace, checkOrigin, rateLimit } from '@/lib/auth';
import {
  receiveEmail,
  inboundConfiguration,
  ensureInboundRoute,
  inspectInboundAttachmentHosts,
} from '@/lib/inbound-email';
import { documentList, readDocument, documentPreview, deleteDocument } from '@/lib/documents';
import { privateJson, businessFailure, businessBody } from '@/lib/business-http';
import { businessAccess, workspaceOrganization } from '@/lib/organization-access';
import { AppError } from '@/lib/errors';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
async function handle(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  try {
    const path = (await params).path || [];
    if (path.length === 1 && path[0] === 'inbound' && req.method === 'POST')
      return privateJson(await receiveEmail(req), 202);
    if (req.method !== 'GET') checkOrigin(req);
    const actor = await requireWorkspace();
    const tenantId = actor.tenantId;
    if (req.method !== 'GET') await rateLimit(tenantId + ':intake', 60);
    if (
      req.method === 'GET' &&
      path.length === 3 &&
      path[0] === 'forwarding' &&
      path[2] === 'attachment-hosts'
    )
      return privateJson(await inspectInboundAttachmentHosts(tenantId, path[1]));
    if (path[0] === 'forwarding' && path.length === 1) {
      if (req.method === 'GET')
        return privateJson({
          configuration: inboundConfiguration(),
          route: await ensureInboundRoute(tenantId, undefined, false),
        });
      if (req.method === 'POST') {
        z.object({ confirmEnable: z.literal(true) })
          .strict()
          .parse(await businessBody(req));
        const org = await workspaceOrganization(tenantId);
        if (org) await businessAccess(org.id, tenantId, ['admin']);
        return privateJson({
          configuration: inboundConfiguration(),
          route: await ensureInboundRoute(tenantId, org?.id, true),
        });
      }
    }
    if (path[0] === 'documents') {
      if (path.length === 1 && req.method === 'GET')
        return privateJson(await documentList(tenantId));
      const id = z.string().uuid().parse(path[1]);
      if (req.method === 'GET') {
        if (path[2] === 'preview')
          return new Response(await documentPreview(tenantId, id), {
            headers: {
              'Content-Type': 'image/jpeg',
              'Cache-Control': 'private, no-store',
              'X-Content-Type-Options': 'nosniff',
            },
          });
        const row = await readDocument(tenantId, id);
        return privateJson({
          id: row.id,
          filename: row.filename,
          extraction: row.extraction,
          status: row.status,
          retained: !!row.objectPath,
          previewUrl:
            row.objectPath && (row.mime.startsWith('image/') || row.mime === 'application/pdf')
              ? '/api/intake/documents/' + id + '/preview'
              : null,
        });
      }
      if (req.method === 'DELETE') return privateJson(await deleteDocument(tenantId, id, tenantId));
    }
    throw new AppError(404, 'NOT_FOUND', 'Intake action not found.');
  } catch (error) {
    return businessFailure(error);
  }
}
const scoped: typeof handle = (req, ctx) => withDatabaseRequest(() => handle(req, ctx));
export const GET = scoped;
export const POST = scoped;
export const DELETE = scoped;
