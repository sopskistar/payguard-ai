import 'server-only';
import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { Webhook } from 'svix';
import { db } from '@/db';
import * as s from '@/db/schema';
import { AppError } from './errors';
import { rateLimit } from './auth';
import {
  privateStorageConfigured,
  privateStorageAuthentication,
  createDocument,
} from './documents';
import { boundedBytes } from './business-http';
import { MAX_UPLOAD } from './intake';
const domain = () => process.env.INVOICE_INBOUND_DOMAIN?.toLowerCase();
export function inboundConfiguration() {
  const missing = [
    !process.env.RESEND_API_KEY && 'Resend receiving API',
    !process.env.RESEND_WEBHOOK_SECRET && 'Verified webhook',
    !domain() && 'Receiving domain',
    !privateStorageConfigured() && 'Private document storage',
  ].filter(Boolean) as string[];
  return {
    configured: !missing.length,
    provider: 'Resend',
    missing,
    storageAuthentication: privateStorageAuthentication(),
    liveEndToEndVerified: false,
    senderTrust: 'A verified webhook authenticates delivery by Resend, not the sender or supplier.',
    automaticSupplierApproval: false,
  };
}
export async function ensureInboundRoute(
  tenantId: string,
  organizationId: string | undefined,
  create: boolean,
) {
  if (!inboundConfiguration().configured) return null;
  const [old] = await (
    await db()
  )
    .select()
    .from(s.inboundRoutes)
    .where(eq(s.inboundRoutes.tenantId, tenantId));
  if (old) return { address: old.alias, enabled: old.enabled };
  if (!create) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain()!))
    throw new AppError(
      503,
      'INBOUND_DOMAIN',
      'The owner must configure a verified receiving domain.',
    );
  const alias = 'invoice-' + randomBytes(18).toString('hex') + '@' + domain();
  const [row] = await (
    await db()
  )
    .insert(s.inboundRoutes)
    .values({ tenantId, organizationId: organizationId || null, alias })
    .onConflictDoNothing()
    .returning();
  if (!row) return ensureInboundRoute(tenantId, organizationId, false);
  return { address: row.alias, enabled: true };
}
export function verifyInbound(
  raw: string,
  headers: Headers,
  secret = process.env.RESEND_WEBHOOK_SECRET,
) {
  if (!secret)
    throw new AppError(
      503,
      'INBOUND_NOT_CONFIGURED',
      'Inbound email is not configured by the application owner.',
    );
  try {
    new Webhook(secret).verify(raw, {
      'svix-id': headers.get('svix-id') || '',
      'svix-timestamp': headers.get('svix-timestamp') || '',
      'svix-signature': headers.get('svix-signature') || '',
    });
    return JSON.parse(raw);
  } catch {
    throw new AppError(400, 'WEBHOOK_SIGNATURE', 'Invalid or stale inbound webhook signature.');
  }
}
const eventSchema = z.object({
  type: z.literal('email.received'),
  data: z.object({ email_id: z.string().uuid(), to: z.array(z.string().max(320)).min(1).max(20) }),
});
function mailbox(value: string) {
  return (/<([^<>]+)>/.exec(value)?.[1] || value).trim().toLowerCase();
}
export function senderEvidence(email: {
  from: string;
  to: string[];
  reply_to?: string[];
  headers?: Record<string, unknown>;
  text?: string | null;
  subject?: string;
  authentication?: { spf: string; dkim: string; dmarc: string } | null;
}) {
  const from = mailbox(email.from);
  const reply = email.reply_to?.map(mailbox) || [];
  const warnings = [
    'Sender identity is unverified. Forwarded mail and From addresses never establish a supplier trust reference.',
  ];
  if (reply.some((v) => v !== from))
    warnings.push(
      'Reply-to differs from From. Use only the previously established supplier contact.',
    );
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(from))
    warnings.push('Malformed or ambiguous sender identity.');
  const authentication = Object.entries(email.headers || {})
    .filter(([k]) => /authentication-results|received-spf/i.test(k))
    .map(([, v]) => String(v).slice(0, 500));
  if (authentication.some((v) => /\b(?:spf|dkim|dmarc)=fail\b/i.test(v)))
    warnings.push(
      'Received headers report an authentication failure; the header assertion itself has not been independently authenticated.',
    );
  if (email.authentication && Object.values(email.authentication).includes('fail'))
    warnings.push(
      'The receiving provider reports SPF, DKIM or DMARC failure. Treat this as a possible spoof and independently verify the supplier.',
    );
  if (!email.authentication)
    warnings.push(
      'The provider did not supply independently computed sender authentication results.',
    );
  return {
    from,
    bodyText: email.text?.slice(0, 3000) || null,
    subject: email.subject?.slice(0, 255) || null,
    replyTo: reply,
    warnings,
    supplierAuthenticated: false,
    providerAuthentication: email.authentication || null,
    headerAuthenticationAssertions: authentication,
  };
}
async function providerGet(path: string) {
  const response = await fetch('https://api.resend.com' + path, {
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY },
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new AppError(
      503,
      'INBOUND_PROVIDER',
      'The inbound provider could not be read. The original message remains unresolved.',
    );
  return JSON.parse((await boundedResponse(response, 512000)).toString('utf8'));
}
export async function boundedResponse(response: Response, max: number) {
  if (Number(response.headers.get('content-length') || 0) > max)
    throw new AppError(413, 'ATTACHMENT_SIZE', 'Attachment exceeds the intake limit.');
  const reader = response.body?.getReader();
  if (!reader) throw new AppError(422, 'ATTACHMENT_EMPTY', 'Attachment content is unavailable.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new AppError(413, 'ATTACHMENT_SIZE', 'Attachment exceeds the intake limit.');
    }
    chunks.push(part.value);
  }
  return Buffer.concat(chunks);
}
export function attachmentUrl(value: string) {
  const url = new URL(value);
  const allowed =
    /^(?:[a-z0-9-]+\.)*(?:resend\.com|resend-storage\.com)$/.test(url.hostname) ||
    /^[a-z0-9.-]+\.s3\.[a-z0-9-]+\.amazonaws\.com$/.test(url.hostname) ||
    /^[a-z0-9-]+\.r2\.cloudflarestorage\.com$/.test(url.hostname);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !allowed)
    throw new AppError(
      422,
      'ATTACHMENT_HOST',
      'Attachment host is not in the owner-reviewed provider allowlist.',
    );
  return url.toString();
}
export async function receiveEmail(req: Request) {
  if (!inboundConfiguration().configured)
    throw new AppError(
      503,
      'INBOUND_NOT_CONFIGURED',
      'Live forwarding requires application-owner receiving, webhook and private-storage configuration.',
    );
  const raw = (await boundedBytes(req, 65536)).toString('utf8');
  const event = eventSchema.parse(verifyInbound(raw, req.headers));
  const recipients = [...new Set(event.data.to.map(mailbox))];
  const routes = await (await db()).select().from(s.inboundRoutes);
  const matches = routes.filter((r) => r.enabled && recipients.includes(r.alias));
  if (matches.length !== 1) return { accepted: false, reason: 'No single authorized destination' };
  const route = matches[0];
  await rateLimit(route.tenantId + ':inbound', 20);
  const id = 'resend:' + event.data.email_id;
  const claim = await (
    await db()
  ).transaction(async (tx) => {
    await tx
      .insert(s.inboundMessages)
      .values({ id, tenantId: route.tenantId, state: 'pending' })
      .onConflictDoNothing();
    const [row] = await tx
      .select()
      .from(s.inboundMessages)
      .where(eq(s.inboundMessages.id, id))
      .for('update');
    if (row.tenantId !== route.tenantId)
      throw new AppError(
        409,
        'EMAIL_DESTINATION_CONFLICT',
        'This message has already been associated with a different workspace.',
      );
    if (row.state === 'completed') return 'completed';
    if (row.leaseUntil && row.leaseUntil > new Date()) return 'processing';
    await tx
      .update(s.inboundMessages)
      .set({
        state: 'processing',
        leaseUntil: new Date(Date.now() + 90000),
        errorCode: null,
        updatedAt: new Date(),
      })
      .where(eq(s.inboundMessages.id, id));
    return 'claimed';
  });
  if (claim !== 'claimed') return { accepted: true, state: claim };
  try {
    const email = z
      .object({
        id: z.string().uuid(),
        from: z.string().max(1000),
        text: z.string().nullable().optional(),
        subject: z.string().optional(),
        to: z.array(z.string()),
        reply_to: z.array(z.string()).optional(),
        headers: z.record(z.string(), z.unknown()).optional(),
        authentication: z
          .object({ spf: z.string(), dkim: z.string(), dmarc: z.string() })
          .nullable()
          .optional(),
      })
      .parse(await providerGet('/emails/receiving/' + event.data.email_id + '?html_format=cid'));
    if (email.id !== event.data.email_id || !email.to.map(mailbox).includes(route.alias))
      throw new AppError(
        409,
        'EMAIL_DESTINATION_CONFLICT',
        'Provider metadata does not match the signed destination.',
      );
    const evidence = senderEvidence(email);
    const listed = z
      .object({
        has_more: z.boolean().optional(),
        data: z
          .array(
            z.object({
              id: z.string().uuid(),
              filename: z.string().min(1).max(250),
              size: z.number().int().nonnegative(),
              download_url: z.url(),
            }),
          )
          .max(3),
      })
      .parse(await providerGet('/emails/receiving/' + email.id + '/attachments'));
    if (listed.has_more)
      throw new AppError(
        413,
        'ATTACHMENT_COUNT',
        'Use at most three invoice attachments per email.',
      );
    if (!listed.data.length)
      throw new AppError(422, 'NO_ATTACHMENTS', 'No supported invoice attachments were received.');
    for (const attachment of listed.data) {
      if (attachment.size > MAX_UPLOAD)
        throw new AppError(413, 'ATTACHMENT_SIZE', 'One attachment exceeds 3 MB.');
      const key = id + ':' + attachment.id;
      const [existing] = await (
        await db()
      )
        .select({ id: s.intakeDocuments.id })
        .from(s.intakeDocuments)
        .where(
          and(eq(s.intakeDocuments.tenantId, route.tenantId), eq(s.intakeDocuments.messageId, key)),
        );
      if (existing) continue;
      const download = await fetch(attachmentUrl(attachment.download_url), {
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });
      if (!download.ok)
        throw new AppError(
          503,
          'ATTACHMENT_DOWNLOAD',
          'The provider attachment could not be downloaded.',
        );
      const bytes = await boundedResponse(download, MAX_UPLOAD);
      try {
        await createDocument(route.tenantId, route.tenantId, bytes, attachment.filename, {
          organizationId: route.organizationId || undefined,
          messageId: key,
          emailEvidence: evidence,
        });
      } catch (error) {
        if (!(error instanceof AppError && error.code === 'DUPLICATE_DOCUMENT')) throw error;
      }
    }
    await (
      await db()
    )
      .update(s.inboundMessages)
      .set({ state: 'completed', leaseUntil: null, updatedAt: new Date() })
      .where(eq(s.inboundMessages.id, id));
    return { accepted: true, state: 'completed', supplierApproved: false };
  } catch (error) {
    await (
      await db()
    )
      .update(s.inboundMessages)
      .set({
        state: 'failed',
        leaseUntil: null,
        errorCode: error instanceof AppError ? error.code : 'INBOUND_PARSE',
        updatedAt: new Date(),
      })
      .where(eq(s.inboundMessages.id, id));
    throw error;
  }
}
