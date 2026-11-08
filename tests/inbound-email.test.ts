import { beforeAll, afterAll, beforeEach, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Webhook } from 'svix';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { PGlite } from '@electric-sql/pglite';
const blobs = vi.hoisted(() => ({ put: vi.fn(), get: vi.fn(), del: vi.fn() }));
vi.mock('@vercel/blob', () => blobs);
import { db } from '@/db';
import * as s from '@/db/schema';
import { DEFAULT_PREFERENCES } from '@/lib/types';
import {
  ensureInboundRoute,
  receiveEmail,
  verifyInbound,
  senderEvidence,
  attachmentUrl,
  boundedResponse,
} from '@/lib/inbound-email';
import { boundedBytes } from '@/lib/business-http';
let directory: string;
const secret = 'whsec_' + Buffer.from('synthetic-svix-test-secret-only-32b').toString('base64');
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'payguard-inbound-unit-'));
  vi.stubEnv('DATABASE_URL', '');
  vi.stubEnv('LOCAL_DATABASE_PATH', directory);
  await migrate(await db(), { migrationsFolder: 'drizzle' });
});
afterAll(async () => {
  await ((await db()) as unknown as { $client: PGlite }).$client.close();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await rm(directory, { recursive: true, force: true });
});
beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', 'fixture-key-not-live');
  vi.stubEnv('RESEND_WEBHOOK_SECRET', secret);
  vi.stubEnv('INVOICE_INBOUND_DOMAIN', 'inbound.fixture.example');
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'fixture-private-blob-not-live');
  blobs.put.mockReset();
  blobs.put.mockImplementation(
    async (path: string, _body: unknown, options: { access: string }) => {
      expect(options.access).toBe('private');
      return { pathname: path };
    },
  );
  blobs.del.mockResolvedValue(undefined);
});
function signed(body: unknown, date = new Date()) {
  const raw = JSON.stringify(body),
    id = 'msg_' + randomUUID(),
    timestamp = String(Math.floor(date.getTime() / 1000)),
    signature = new Webhook(secret).sign(id, date, raw);
  return new Request('http://localhost/api/intake/inbound', {
    method: 'POST',
    headers: {
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': signature,
      'content-type': 'application/json',
    },
    body: raw,
  });
}
async function tenant() {
  const id = randomUUID();
  await (await db()).insert(s.users).values({
    id,
    name: 'Synthetic inbound workspace',
    role: 'member',
    settings: DEFAULT_PREFERENCES,
  });
  const route = await ensureInboundRoute(id, undefined, true);
  return { id, address: route!.address };
}
it('verifies the exact raw payload and refuses missing, forged and stale webhook signatures', async () => {
  const r = signed({ type: 'test' });
  expect(verifyInbound(await r.text(), r.headers)).toEqual({ type: 'test' });
  expect(() => verifyInbound('{}', r.headers)).toThrow('signature');
  expect(() => verifyInbound('{}', new Headers())).toThrow('signature');
  const stale = signed({ type: 'test' }, new Date(Date.now() - 3600000));
  expect(() => verifyInbound('{"type":"test"}', stale.headers)).toThrow('signature');
});
it.each(['inbound-cdn.resend.com', 'cdn.resend.app'])(
  'processes a provider-verified message from %s once, preserves sender risk evidence and never creates a trusted supplier',
  async (host) => {
    const t = await tenant(),
      id = randomUUID(),
      attachmentId = randomUUID(),
      bytes = Buffer.from(
        'Supplier: Synthetic Forwarded Supplier\nInvoice: INBOUND-01\nAmount: 25\nCurrency: USD',
      );
    if (host === 'cdn.resend.app')
      await (await db()).insert(s.inboundMessages).values({
        id: 'resend:' + id,
        tenantId: t.id,
        state: 'failed',
        errorCode: 'ATTACHMENT_HOST',
      });
    const fetch = vi.fn(async (url: string) =>
      new URL(url).hostname === host
        ? new Response(bytes)
        : new Response(
            JSON.stringify(
              url.includes('/attachments')
                ? {
                    has_more: false,
                    data: [
                      {
                        id: attachmentId,
                        filename: 'invoice.txt',
                        size: bytes.length,
                        download_url: 'https://' + host + '/' + id + '/' + attachmentId,
                      },
                    ],
                  }
                : {
                    id,
                    from: 'sender@untrusted.example',
                    to: [t.address],
                    reply_to: ['attacker@different.example'],
                    authentication: { spf: 'pass', dkim: 'fail', dmarc: 'fail' },
                  },
            ),
          ),
    );
    vi.stubGlobal('fetch', fetch);
    const event = { type: 'email.received', data: { email_id: id, to: [t.address] } };
    expect(await receiveEmail(signed(event))).toMatchObject({
      state: 'completed',
      supplierApproved: false,
    });
    expect(await receiveEmail(signed(event))).toMatchObject({ state: 'completed' });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(blobs.put).toHaveBeenCalledTimes(1);
    const docs = await (await db()).select().from(s.intakeDocuments);
    const row = docs.find((d) => d.tenantId === t.id)!;
    expect(row.status).toBe('review');
    expect(row.invoiceId).toBeNull();
    expect(row.messageId).toBe('resend:' + id + ':' + attachmentId);
    expect(
      (await (await db()).select().from(s.inboundMessages)).find((m) => m.id === 'resend:' + id),
    ).toMatchObject({ state: 'completed', errorCode: null });
    expect(
      (row.extraction.emailEvidence as { supplierAuthenticated: boolean; warnings: string[] })
        .supplierAuthenticated,
    ).toBe(false);
    expect((row.extraction.emailEvidence as { warnings: string[] }).warnings.join(' ')).toContain(
      'failure',
    );
    expect(await (await db()).select().from(s.vendorTrustProfiles)).toHaveLength(0);
  },
);
it('ignores an unauthorized destination without fetching another workspace message', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  expect(
    await receiveEmail(
      signed({
        type: 'email.received',
        data: { email_id: randomUUID(), to: ['unknown@inbound.fixture.example'] },
      }),
    ),
  ).toMatchObject({ accepted: false });
  expect(fetch).not.toHaveBeenCalled();
});
it('does not accept provider metadata for a different receiving workspace', async () => {
  const t = await tenant(),
    id = randomUUID();
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id,
            from: 'sender@fixture.example',
            to: ['other@inbound.fixture.example'],
          }),
        ),
    ),
  );
  await expect(
    receiveEmail(signed({ type: 'email.received', data: { email_id: id, to: [t.address] } })),
  ).rejects.toMatchObject({ code: 'EMAIL_DESTINATION_CONFLICT' });
});
it('keeps live forwarding disabled when required owner configuration is absent', async () => {
  vi.stubEnv('RESEND_WEBHOOK_SECRET', '');
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  await expect(
    receiveEmail(
      signed({ type: 'email.received', data: { email_id: randomUUID(), to: ['x@example.com'] } }),
    ),
  ).rejects.toMatchObject({ code: 'INBOUND_NOT_CONFIGURED' });
  expect(fetch).not.toHaveBeenCalled();
});
it('treats provider sender authentication separately from untrusted headers and supplier approval', () => {
  const e = senderEvidence({
    from: 'accounts@supplier.example',
    to: [],
    authentication: { spf: 'pass', dkim: 'pass', dmarc: 'pass' },
    headers: { 'Authentication-Results': 'dmarc=pass' },
  });
  expect(e.supplierAuthenticated).toBe(false);
  expect(e.providerAuthentication?.dmarc).toBe('pass');
  const unavailable = senderEvidence({ from: 'bad', to: [] });
  expect(unavailable.warnings.join(' ')).toContain('unverified');
});
it('rejects SSRF hosts, redirects credentials and oversized/chunked attachments', async () => {
  for (const u of [
    'http://inbound-cdn.resend.com/x',
    'https://127.0.0.1/x',
    'https://user:password@inbound-cdn.resend.com/x',
    'https://resend.com.attacker.example/x',
    'https://[::1]/x',
  ])
    expect(() => attachmentUrl(u)).toThrow();
  expect(attachmentUrl('https://inbound-cdn.resend.com/file?signature=fixture')).toContain(
    'https://inbound-cdn.resend.com',
  );
  await expect(boundedResponse(new Response(new Uint8Array(20)), 10)).rejects.toMatchObject({
    code: 'ATTACHMENT_SIZE',
  });
  await expect(
    boundedBytes(new Request('http://localhost', { method: 'POST', body: new Uint8Array(20) }), 10),
  ).rejects.toMatchObject({ code: 'BODY_SIZE' });
});

it('does not trust lookalikes, other resend.app subdomains, credentials, ports or insecure CDN URLs', () => {
  for (const url of [
    'http://cdn.resend.app/invoice.pdf',
    'https://cdn.resend.app.attacker.example/invoice.pdf',
    'https://attacker.resend.app/invoice.pdf',
    'https://sub.cdn.resend.app/invoice.pdf',
    'https://cdn-resend.app/invoice.pdf',
    'https://cdn.resend.app:8443/invoice.pdf',
    'https://user:password@cdn.resend.app/invoice.pdf',
    'https://cdn.resend.app@127.0.0.1/invoice.pdf',
  ])
    expect(() => attachmentUrl(url)).toThrow();
});
