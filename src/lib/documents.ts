import 'server-only';
import { and, eq, desc, isNull, lt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db, type Database } from '@/db';
import * as s from '@/db/schema';
import { AppError } from './errors';
import { rateLimit } from './auth';
import { businessAccess, businessWriteGuard, REQUEST_ROLES } from './organization-access';
import { extractInvoice, type Extraction } from './intake';
export const privateStorageConfigured = () => !!process.env.BLOB_READ_WRITE_TOKEN;
export type DocumentExtraction = Extraction & {
  documentId: string;
  retained: boolean;
  duplicates: { id: string; number: string }[];
  supplierMatches: {
    id: string;
    name: string;
    match: 'exact' | 'possible';
    establishedRecipient?: string;
  }[];
};
export async function createDocument(
  tenantId: string,
  actorId: string,
  bytes: Uint8Array,
  filename: string,
  options: {
    organizationId?: string;
    messageId?: string;
    emailEvidence?: Record<string, unknown>;
  } = {},
): Promise<DocumentExtraction> {
  await rateLimit(tenantId + ':document-processing', 20);
  await rateLimit('intake:document-processing:global', 100);
  const extracted = await extractInvoice(bytes, filename);
  if (options.emailEvidence) {
    const evidence = options.emailEvidence;
    extracted.warnings = [
      ...(extracted.warnings || []),
      ...(Array.isArray(evidence.warnings) ? evidence.warnings.map(String) : []),
    ];
    if (typeof evidence.bodyText === 'string') {
      const body = evidence.bodyText.slice(0, 3000);
      extracted.sourceText =
        (extracted.sourceText || '') + '\nForwarded-email body (untrusted):\n' + body;
      const directive =
        /(?:ignore|override|bypass|disregard).{0,100}(?:instructions?|rules?|verification|safety)/i.test(
          body,
        );
      extracted.fields.memo = (
        (directive ? 'Untrusted email directive: ignore verification instructions. ' : '') +
        (extracted.fields.memo || '') +
        '\nForwarded-email text (untrusted): ' +
        body
      ).slice(0, 1000);
      if (directive)
        extracted.warnings.push(
          'The email body attempts to bypass verification. It cannot approve this invoice.',
        );
    }
  }
  const d = await db();
  const [existing] = await d
    .select()
    .from(s.intakeDocuments)
    .where(
      and(
        eq(s.intakeDocuments.tenantId, tenantId),
        eq(s.intakeDocuments.sha256, extracted.metadata.sha256),
      ),
    );
  if (existing)
    throw new AppError(
      409,
      'DUPLICATE_DOCUMENT',
      'This exact document already exists in this workspace. Open its intake record instead of importing it again.',
    );
  const vendors = await d.select().from(s.vendors).where(eq(s.vendors.tenantId, tenantId));
  const profiles = await d
    .select()
    .from(s.vendorTrustProfiles)
    .where(eq(s.vendorTrustProfiles.tenantId, tenantId));
  const name = extracted.fields.vendor?.toLowerCase().trim();
  const normalized = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');
  const matches = vendors
    .filter((v) => name && (v.normalizedName === name || normalized(v.name) === normalized(name)))
    .map((v) => ({
      id: v.id,
      name: v.name,
      establishedRecipient: profiles.find((p) => p.vendorId === v.id)?.trustedRecipient,
      match: (v.normalizedName === name ? 'exact' : 'possible') as 'exact' | 'possible',
    }));
  const existingInvoices = await d
    .select({ id: s.invoices.id, number: s.invoices.number, vendorId: s.invoices.vendorId })
    .from(s.invoices)
    .where(eq(s.invoices.tenantId, tenantId));
  const duplicates = existingInvoices
    .filter(
      (i) =>
        i.number.toLowerCase().trim() === extracted.fields.number?.toLowerCase().trim() &&
        matches.some((v) => v.id === i.vendorId),
    )
    .map(({ id, number }) => ({ id, number }));
  const id = randomUUID();
  let objectPath: string | null = null;
  const blobPrefix = 'intake/' + tenantId + '/' + id;
  try {
    if (privateStorageConfigured()) {
      const { put } = await import('@vercel/blob');
      const object = await put(blobPrefix + '/source', Buffer.from(bytes), {
        access: 'private',
        contentType: extracted.mime,
        addRandomSuffix: false,
        allowOverwrite: false,
        abortSignal: AbortSignal.timeout(12000),
      });
      objectPath = object.pathname;
      if (extracted.preview)
        await put(
          blobPrefix + '/preview.jpg',
          Buffer.from(extracted.preview.split(',')[1], 'base64'),
          {
            access: 'private',
            contentType: 'image/jpeg',
            addRandomSuffix: false,
            allowOverwrite: false,
            abortSignal: AbortSignal.timeout(12000),
          },
        );
    }
    const metadata = { ...extracted };
    delete metadata.preview;
    await d.transaction(async (tx) => {
      if (options.organizationId && !options.messageId)
        await businessAccess(
          options.organizationId,
          actorId,
          REQUEST_ROLES,
          tx as unknown as Database,
          true,
        );
      else if (!options.messageId)
        await businessWriteGuard(tenantId, tx as unknown as Database, actorId);
      await tx.insert(s.intakeDocuments).values({
        id,
        tenantId,
        createdBy: actorId,
        organizationId: options.organizationId || null,
        filename: extracted.metadata.filename,
        sha256: extracted.metadata.sha256,
        mime: extracted.mime!,
        size: bytes.length,
        source: options.messageId ? 'email' : extracted.source!,
        extraction: { ...metadata, emailEvidence: options.emailEvidence || null },
        objectPath,
        messageId: options.messageId || null,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      });
      await tx.insert(s.auditEvents).values({
        tenantId,
        type: 'intake.document_received',
        entityId: id,
        detail: {
          actorId: options.messageId ? null : actorId,
          actorKind: options.messageId ? 'verified inbound provider' : 'authenticated user',
          source: options.messageId ? 'email' : 'upload',
          sha256: extracted.metadata.sha256,
          retained: !!objectPath,
          untrustedContent: true,
        },
      });
    });
    return {
      ...extracted,
      documentId: id,
      retained: !!objectPath,
      duplicates,
      supplierMatches: matches,
    };
  } catch (error) {
    if (objectPath) {
      const { del } = await import('@vercel/blob');
      await del([objectPath, blobPrefix + '/preview.jpg']).catch(() => {});
    }
    throw error;
  }
}
export async function documentList(tenantId: string) {
  return (await db())
    .select({
      id: s.intakeDocuments.id,
      filename: s.intakeDocuments.filename,
      status: s.intakeDocuments.status,
      source: s.intakeDocuments.source,
      invoiceId: s.intakeDocuments.invoiceId,
      createdAt: s.intakeDocuments.createdAt,
      expiresAt: s.intakeDocuments.expiresAt,
    })
    .from(s.intakeDocuments)
    .where(and(eq(s.intakeDocuments.tenantId, tenantId), isNull(s.intakeDocuments.deletedAt)))
    .orderBy(desc(s.intakeDocuments.createdAt))
    .limit(50);
}
export async function readDocument(tenantId: string, id: string) {
  const [row] = await (
    await db()
  )
    .select()
    .from(s.intakeDocuments)
    .where(
      and(
        eq(s.intakeDocuments.tenantId, tenantId),
        eq(s.intakeDocuments.id, id),
        isNull(s.intakeDocuments.deletedAt),
      ),
    );
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Document not found.');
  if (row.expiresAt <= new Date())
    throw new AppError(
      410,
      'DOCUMENT_EXPIRED',
      'Document review retention has expired. The saved invoice and audit remain available.',
    );
  return row;
}
export async function documentPreview(tenantId: string, id: string) {
  const row = await readDocument(tenantId, id);
  if (!row.objectPath)
    throw new AppError(
      404,
      'NOT_RETAINED',
      'Source processing was ephemeral. Use the original local document to verify it.',
    );
  const { get } = await import('@vercel/blob');
  const result = await get(row.objectPath.replace(/\/source$/, '/preview.jpg'), {
    access: 'private',
    useCache: false,
    abortSignal: AbortSignal.timeout(12000),
  });
  if (!result || result.statusCode !== 200)
    throw new AppError(404, 'PREVIEW_UNAVAILABLE', 'Source preview is unavailable.');
  return result.stream;
}
export async function deleteDocument(tenantId: string, id: string, actorId: string) {
  return (await db()).transaction(async (tx) => {
    await businessWriteGuard(tenantId, tx as unknown as Database, actorId);
    const [row] = await tx
      .select()
      .from(s.intakeDocuments)
      .where(and(eq(s.intakeDocuments.tenantId, tenantId), eq(s.intakeDocuments.id, id)))
      .for('update');
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Document not found.');
    if (row.deletedAt) return { deleted: true };
    if (row.objectPath) {
      const { del } = await import('@vercel/blob');
      await del([row.objectPath, row.objectPath.replace(/\/source$/, '/preview.jpg')], {
        abortSignal: AbortSignal.timeout(12000),
      });
    }
    await tx
      .update(s.intakeDocuments)
      .set({
        deletedAt: new Date(),
        status: 'deleted',
        objectPath: null,
        extraction: { deleted: true },
      })
      .where(and(eq(s.intakeDocuments.id, id), eq(s.intakeDocuments.tenantId, tenantId)));
    await tx.insert(s.auditEvents).values({
      tenantId,
      type: 'intake.document_deleted',
      entityId: id,
      detail: { actorId, invoicePreserved: true, sha256: row.sha256 },
    });
    return { deleted: true };
  });
}
export async function bindDocument(
  tenantId: string,
  id: string,
  invoiceId: string,
  connection: Database,
) {
  const [document] = await connection
    .select()
    .from(s.intakeDocuments)
    .where(and(eq(s.intakeDocuments.id, id), eq(s.intakeDocuments.tenantId, tenantId)))
    .for('update');
  if (!document || document.deletedAt || document.expiresAt <= new Date())
    throw new AppError(
      409,
      'DOCUMENT_UNAVAILABLE',
      'The original intake record is unavailable for confirmation.',
    );
  if (document.invoiceId && document.invoiceId !== invoiceId)
    throw new AppError(
      409,
      'DUPLICATE_DOCUMENT',
      'This document has already been saved as another invoice.',
    );
  await connection
    .update(s.intakeDocuments)
    .set({ invoiceId, status: 'saved' })
    .where(eq(s.intakeDocuments.id, id));
  return document;
}

// Platform retention task: no user-supplied tenant/id; only expired intake drafts.
// Saved invoices, financial rows, checksums and audit history are never deleted.
export async function purgeExpiredDocuments() {
  const d = await db();
  const rows = await d
    .select()
    .from(s.intakeDocuments)
    .where(and(isNull(s.intakeDocuments.deletedAt), lt(s.intakeDocuments.expiresAt, new Date())))
    .limit(10);
  let deleted = 0,
    held = 0;
  for (const row of rows) {
    try {
      if (row.objectPath) {
        const { del } = await import('@vercel/blob');
        await del([row.objectPath, row.objectPath.replace(/\/source$/, '/preview.jpg')], {
          abortSignal: AbortSignal.timeout(5000),
        });
      }
      await d.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(s.intakeDocuments)
          .where(eq(s.intakeDocuments.id, row.id))
          .for('update');
        if (current.deletedAt || current.expiresAt > new Date()) return;
        await tx
          .update(s.intakeDocuments)
          .set({
            deletedAt: new Date(),
            status: 'deleted',
            objectPath: null,
            extraction: { deleted: true, reason: 'retention_expired' },
          })
          .where(eq(s.intakeDocuments.id, row.id));
        await tx.insert(s.auditEvents).values({
          tenantId: row.tenantId,
          type: 'intake.retention_purged',
          entityId: row.id,
          detail: {
            actorKind: 'authorized platform retention task',
            sha256: row.sha256,
            invoicePreserved: true,
          },
        });
      });
      deleted++;
    } catch {
      held++;
    }
  }
  return { deleted, held, maximumPerRun: 10, invoiceChanges: 0 };
}
