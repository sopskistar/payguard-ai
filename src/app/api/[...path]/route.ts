import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db, storageKind } from '@/db';
import * as s from '@/db/schema';
import {
  checkOrigin,
  currentUser,
  currentActor,
  login,
  logout,
  rateLimit,
  requireOwner,
  requireWorkspace,
} from '@/lib/auth';
import { AppError, safeError } from '@/lib/errors';
import { publicSnapshot } from '@/lib/demo';
import {
  snapshot,
  saveInvoice,
  changeStatus,
  deleteInvoice,
  seedDemo,
  resetDemo,
  audit,
  ownedInvoice,
  preferences,
} from '@/lib/store';
import {
  address,
  correctionInput,
  digestSchema,
  invoiceInput,
  settingsInput,
} from '@/lib/validation';
import {
  assess,
  memoryClient,
  memoryConfigured,
  prepareSeed,
  processMemoryJob,
  recallMemories,
  recordCorrection,
} from '@/lib/integrations/memory';
import {
  chainHealth,
  inspectTransaction,
  verifyInvoice,
  watchWallet,
} from '@/lib/integrations/tatum';
import {
  profileInput,
  instructionInput,
  humanInput,
  saveTrust,
  saveInstructions,
  recordHumanCheck,
  trustContext,
} from '@/lib/verify-store';
import {
  issueWalletChallenge,
  verifyWalletLogin,
  walletAddressInput,
  walletProofInput,
} from '@/lib/wallet-auth';
import { extractInvoice, MAX_UPLOAD } from '@/lib/intake';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
async function body(req: Request): Promise<unknown> {
  if (Number(req.headers.get('content-length') || 0) > 20000)
    throw new AppError(413, 'BODY_SIZE', 'Request body is too large.');
  const reader = req.body?.getReader();
  if (!reader) throw new AppError(400, 'BODY', 'Request body required.');
  let data = '';
  let size = 0;
  const decoder = new TextDecoder();
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > 20000) {
      await reader.cancel();
      throw new AppError(413, 'BODY_SIZE', 'Request body is too large.');
    }
    data += decoder.decode(part.value, { stream: true });
  }
  try {
    return JSON.parse(data);
  } catch {
    throw new AppError(400, 'JSON', 'Invalid JSON request.');
  }
}
async function handle(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    const route = (await context.params).path.join('/');
    const method = req.method;
    if (method !== 'GET') checkOrigin(req);
    if (route === 'snapshot' && method === 'GET') {
      const tenantId = await currentUser();
      return json(tenantId ? await snapshot(tenantId) : publicSnapshot());
    }
    if (route === 'auth/session' && method === 'GET') {
      const actor = await currentActor();
      return json(
        actor
          ? { authenticated: true, role: actor.role, walletAddress: actor.walletAddress }
          : { authenticated: false },
      );
    }
    if (route === 'auth/wallet/status' && method === 'GET') {
      const { walletOnboardingAllowed, slushOnboardingBlocked, serviceWalletSigningAllowed } =
        await import('@/lib/wallet-policy');
      return json({
        allowed: walletOnboardingAllowed(),
        slushBlocked: slushOnboardingBlocked(),
        paymentSigningAllowed: serviceWalletSigningAllowed(),
        review: 'Slush production domain review pending; never override provider warnings',
      });
    }
    if (route === 'auth/wallet/challenge' && method === 'POST') {
      const input = z
        .object({ address: walletAddressInput })
        .strict()
        .parse(await body(req));
      return json(await issueWalletChallenge(input.address));
    }
    if (route === 'auth/wallet/verify' && method === 'POST')
      return json(await verifyWalletLogin(walletProofInput.parse(await body(req))));
    if (route === 'auth/login' && method === 'POST') {
      const input = z.object({ password: z.string().max(256) }).parse(await body(req));
      await login(input.password);
      return json({ ok: true });
    }
    if (route === 'auth/logout' && method === 'POST') {
      await logout();
      return json({ ok: true });
    }
    const { tenantId } = await requireWorkspace();
    if (['memory/seed', 'demo/seed', 'demo/reset', 'integrations/health'].includes(route))
      await requireOwner();
    if (method !== 'GET') await rateLimit(`${tenantId}:requests`, 250);
    if (route === 'vendors' && method === 'POST') {
      const input = z
        .object({ name: z.string().trim().min(2).max(120) })
        .strict()
        .parse(await body(req));
      const [vendor] = await (
        await db()
      )
        .insert(s.vendors)
        .values({
          tenantId,
          name: input.name,
          normalizedName: input.name.toLowerCase(),
          isDemo: false,
        })
        .onConflictDoUpdate({
          target: [s.vendors.tenantId, s.vendors.normalizedName, s.vendors.isDemo],
          set: { name: input.name },
        })
        .returning();
      await audit(tenantId, 'vendor.created', vendor.id, { humanReferenceRequired: true });
      return json({ id: vendor.id }, 201);
    }
    if (route === 'vendors/trust' && method === 'POST') {
      await saveTrust(tenantId, profileInput.parse(await body(req)));
      return json({ ok: true });
    }
    if (route === 'instructions' && method === 'POST') {
      await saveInstructions(tenantId, instructionInput.parse(await body(req)));
      return json({ ok: true });
    }
    if (route === 'instructions/verify' && method === 'POST')
      return json(await recordHumanCheck(tenantId, humanInput.parse(await body(req))));
    if (route === 'instructions/context' && method === 'POST') {
      const input = z.object({ invoiceId: z.string().uuid() }).parse(await body(req));
      return json(await trustContext(tenantId, await ownedInvoice(tenantId, input.invoiceId)));
    }
    if (route === 'invoices' && method === 'POST') {
      const input = invoiceInput.parse(await body(req));
      const id = await saveInvoice(tenantId, input);
      const assessment = await assess(tenantId, id, true);
      return json({ id, assessment }, 201);
    }
    const invoiceRoute = /^invoices\/([0-9a-f-]{36})$/.exec(route);
    if (invoiceRoute && method === 'PATCH') {
      const id = z.string().uuid().parse(invoiceRoute[1]);
      const input = invoiceInput.parse(await body(req));
      await saveInvoice(tenantId, input, id);
      return json({ id, assessment: await assess(tenantId, id, true) });
    }
    if (invoiceRoute && method === 'DELETE') {
      await deleteInvoice(tenantId, z.string().uuid().parse(invoiceRoute[1]));
      return json({ ok: true });
    }
    if (route === 'invoices/status' && method === 'POST') {
      const input = z
        .object({
          invoiceId: z.string().uuid(),
          status: z.enum(['open', 'approved', 'rejected', 'escalated']),
          reason: z.string().trim().min(8).max(1000),
        })
        .parse(await body(req));
      await changeStatus(tenantId, input.invoiceId, input.status, input.reason);
      return json({ ok: true });
    }
    if (route === 'invoices/extract' && method === 'POST') {
      if (Number(req.headers.get('content-length') || 0) > MAX_UPLOAD + 16384)
        throw new AppError(413, 'UPLOAD_SIZE', 'Maximum upload size is 5 MB.');
      // Count the stream before multipart parsing, including chunked uploads.
      const reader = req.body?.getReader();
      if (!reader) throw new AppError(400, 'UPLOAD', 'Select an invoice file.');
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const p = await reader.read();
        if (p.done) break;
        size += p.value.byteLength;
        if (size > MAX_UPLOAD + 16384) {
          await reader.cancel();
          throw new AppError(413, 'UPLOAD_SIZE', 'Maximum upload size is 5 MB.');
        }
        chunks.push(p.value);
      }
      const bytes = Buffer.concat(chunks);
      const parsed = await new Request(req.url, {
        method: 'POST',
        headers: { 'content-type': req.headers.get('content-type') || '' },
        body: bytes,
      }).formData();
      const file = parsed.get('file');
      if (!(file instanceof File)) throw new AppError(400, 'UPLOAD', 'Select an invoice file.');
      await rateLimit(`${tenantId}:uploads`, 30);
      return json(await extractInvoice(new Uint8Array(await file.arrayBuffer()), file.name));
    }
    if (route === 'review' && method === 'POST') {
      const input = z
        .object({ invoiceId: z.string().uuid(), memoryOn: z.boolean() })
        .parse(await body(req));
      return json(await assess(tenantId, input.invoiceId, input.memoryOn));
    }
    if (route === 'corrections' && method === 'POST')
      return json(await recordCorrection(tenantId, correctionInput.parse(await body(req))));
    if (route === 'memory/recall' && method === 'POST') {
      const input = z.object({ query: z.string().trim().min(3).max(500) }).parse(await body(req));
      return json(await recallMemories(tenantId, input.query));
    }
    if (route === 'memory/seed' && method === 'POST') return json(await prepareSeed(tenantId));
    if (route === 'memory/resume' && method === 'POST') {
      const input = z.object({ id: z.string().uuid() }).parse(await body(req));
      return json(await processMemoryJob(tenantId, input.id));
    }
    if (route === 'demo/seed' && method === 'POST') {
      await seedDemo(tenantId);
      return json({ ok: true });
    }
    if (route === 'demo/reset' && method === 'POST') {
      await resetDemo(tenantId);
      return json({ ok: true });
    }
    if (route === 'demo/next' && method === 'POST') {
      const input = z.object({ invoiceId: z.string().uuid() }).parse(await body(req));
      const old = await ownedInvoice(tenantId, input.invoiceId);
      if (!old.isDemo) throw new AppError(400, 'DEMO_ONLY', 'Choose a sample invoice.');
      const today = new Date().toISOString().slice(0, 10);
      const id = await saveInvoice(tenantId, {
        ...old,
        number: old.number + '-next-' + Date.now().toString().slice(-5),
        issued: today,
        due: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        importKey: randomUUID(),
        source: 'manual',
      });
      return json({ id, assessment: await assess(tenantId, id, true) });
    }
    if (route === 'wallets' && method === 'POST') {
      const input = z
        .object({ address, label: z.string().trim().min(2).max(80) })
        .parse(await body(req));
      const [wallet] = await (
        await db()
      )
        .insert(s.watchedWallets)
        .values({ ...input, tenantId })
        .onConflictDoUpdate({
          target: [s.watchedWallets.tenantId, s.watchedWallets.address],
          set: { label: input.label },
        })
        .returning();
      await audit(tenantId, 'wallet.watched', wallet.id, { watchOnly: true });
      return json(wallet);
    }
    if (route === 'wallets/remove' && method === 'POST') {
      const input = z.object({ id: z.string().uuid() }).parse(await body(req));
      const removed = await (
        await db()
      )
        .delete(s.watchedWallets)
        .where(and(eq(s.watchedWallets.tenantId, tenantId), eq(s.watchedWallets.id, input.id)))
        .returning();
      if (!removed.length) throw new AppError(404, 'NOT_FOUND', 'Wallet not found.');
      await audit(tenantId, 'wallet.removed', input.id, {});
      return json({ ok: true });
    }
    if (route === 'wallets/refresh' && method === 'POST') {
      const input = z
        .object({
          id: z.string().uuid(),
          cursor: z
            .string()
            .max(2048)
            .regex(/^[A-Za-z0-9+/=]+$/)
            .nullable()
            .default(null),
          direction: z.enum(['incoming', 'outgoing']).default('incoming'),
        })
        .parse(await body(req));
      const [wallet] = await (
        await db()
      )
        .select()
        .from(s.watchedWallets)
        .where(and(eq(s.watchedWallets.tenantId, tenantId), eq(s.watchedWallets.id, input.id)));
      if (!wallet) throw new AppError(404, 'NOT_FOUND', 'Wallet not found.');
      await rateLimit(`${tenantId}:rpc`, Number(process.env.RPC_REQUESTS_PER_HOUR) || 120);
      const result = await watchWallet(wallet.address, input.cursor, input.direction);
      await (
        await db()
      )
        .update(s.watchedWallets)
        .set({ balance: result.balance.totalBalance, refreshedAt: new Date() })
        .where(eq(s.watchedWallets.id, wallet.id));
      await audit(tenantId, 'wallet.refreshed', wallet.id, {
        chainId: result.chainId,
        transactions: result.transactions.data.length,
      });
      return json(result);
    }
    if (route === 'transactions/inspect' && method === 'POST') {
      const input = z.object({ digest: digestSchema }).parse(await body(req));
      await rateLimit(`${tenantId}:rpc`, Number(process.env.RPC_REQUESTS_PER_HOUR) || 120);
      return json(await inspectTransaction(input.digest));
    }
    if (route === 'payments/verify' && method === 'POST') {
      const input = z
        .object({ invoiceId: z.string().uuid(), digest: digestSchema })
        .parse(await body(req));
      const invoice = await ownedInvoice(tenantId, input.invoiceId);
      const d = await db();
      const [existing] = await d
        .select()
        .from(s.paymentMatches)
        .where(
          and(eq(s.paymentMatches.tenantId, tenantId), eq(s.paymentMatches.digest, input.digest)),
        );
      if (existing?.invoiceId === invoice.id) return json(existing.evidence);
      await rateLimit(`${tenantId}:rpc`, Number(process.env.RPC_REQUESTS_PER_HOUR) || 120);
      const result = await verifyInvoice(invoice, input.digest, !!existing);
      if (result.status === 'Confirmed match') {
        await d.transaction(async (tx) => {
          const [current] = await tx
            .select()
            .from(s.invoices)
            .where(and(eq(s.invoices.id, invoice.id), eq(s.invoices.tenantId, tenantId)))
            .for('update');
          if (
            !current ||
            current.recipient !== invoice.recipient ||
            current.coinType !== invoice.coinType ||
            current.tokenAmount !== invoice.tokenAmount
          )
            throw new AppError(
              409,
              'INVOICE_CHANGED',
              'Invoice changed during verification. Please recheck.',
            );
          const saved = await tx
            .insert(s.paymentMatches)
            .values({
              tenantId,
              invoiceId: invoice.id,
              digest: input.digest,
              network: 'mainnet',
              evidence: result,
            })
            .onConflictDoNothing()
            .returning();
          if (!saved.length) {
            result.status = 'Conflict';
            result.criteria.push({
              label: 'Database uniqueness',
              passed: false,
              detail: 'This digest or invoice was already matched by another request.',
            });
          } else {
            await tx
              .update(s.invoices)
              .set({ status: 'paid', updatedAt: new Date() })
              .where(eq(s.invoices.id, invoice.id));
            await tx.insert(s.auditEvents).values({
              tenantId,
              type: 'payment.confirmed',
              entityId: invoice.id,
              detail: { digest: input.digest, chainId: result.chainId, isDemo: invoice.isDemo },
            });
          }
        });
      }
      await d.insert(s.paymentCandidates).values({
        tenantId,
        invoiceId: invoice.id,
        digest: input.digest,
        status: result.status,
        evidence: result,
      });
      await audit(tenantId, 'payment.verification', invoice.id, {
        digest: input.digest,
        status: result.status,
      });
      return json(result);
    }
    if (route === 'settings' && method === 'POST') {
      const settings = settingsInput.parse(await body(req));
      await (await db()).update(s.users).set({ settings }).where(eq(s.users.id, tenantId));
      await audit(tenantId, 'settings.changed', null, {
        threshold: settings.threshold,
        currency: settings.currency,
      });
      return json({ ok: true });
    }
    if (route === 'integrations/health' && method === 'POST') {
      await rateLimit(`${tenantId}:diagnostics`, 20);
      const statuses: Record<string, unknown> = {
        storage: storageKind(),
        checkedAt: new Date().toISOString(),
      };
      const results = await Promise.allSettled([
        (await db()).execute(sql`select 1 as connected`),
        memoryConfigured()
          ? memoryClient(tenantId).health()
          : Promise.reject(
              new AppError(503, 'NOT_CONFIGURED', 'Walrus: integration not configured.'),
            ),
        chainHealth(),
      ]);
      ['database', 'walrus', 'tatum'].forEach((name, i) => {
        const r = results[i];
        statuses[name] =
          r.status === 'fulfilled'
            ? { status: 'Connected', evidence: r.value }
            : { status: 'Unavailable', detail: safeError(r.reason) };
      });
      await audit(tenantId, 'integration.health', null, {
        tatum: statuses.tatum,
        walrus: statuses.walrus,
      });
      return json(statuses);
    }
    if (route === 'preferences' && method === 'GET') return json(await preferences(tenantId));
    throw new AppError(404, 'NOT_FOUND', 'API route not found.');
  } catch (error) {
    if (error instanceof ZodError)
      return json(
        {
          error: 'Check the form fields.',
          code: 'VALIDATION',
          details: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        },
        400,
      );
    if (error instanceof AppError)
      return json({ error: error.message, code: error.code }, error.status);
    // Never return driver messages, SQL parameters, credentials or full invoice payloads.
    return json({ error: safeError(error), code: 'REQUEST_FAILED' }, 500);
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
