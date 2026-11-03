import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireWorkspace, checkOrigin, rateLimit } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import { withDatabaseRequest } from '@/db';
import { requestFailure } from '@/lib/request-diagnostics';
import { serviceWalletSigningAllowed, walletOperationPolicy } from '@/lib/wallet-policy';
import {
  SERVICE_SESSION_CAP,
  serviceAddressSchema,
  decodeServicePaymentHeader,
} from '@/lib/service-protocol';
import {
  serviceReady,
  serviceMode,
  serviceSettlementEnabled,
  servicePreparationAllowed,
  listServiceIntents,
  quoteService,
  approveService,
  fulfillService,
  rememberService,
  cancelService,
  servicePreflight,
  ownedService,
  serviceSetup,
  serviceProgress,
  recordServiceWalletEvent,
  serviceExposure,
  publicServiceExposure,
  publicServiceEnabled,
} from '@/lib/service-payments';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
async function handle(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  let stage = 'workspace-authentication';
  try {
    if (req.method !== 'GET') checkOrigin(req);
    const actor = await requireWorkspace();
    const tenantId = actor.tenantId;
    if (actor.role === 'member' && !actor.walletAddress)
      throw new AppError(
        403,
        'WALLET_AUTH_REQUIRED',
        'A verified wallet account is required for customer checkout.',
      );
    if (req.method !== 'GET') await rateLimit(tenantId + ':service-payments', 30);
    const path = (await params).path || [];
    stage = req.method === 'GET' ? 'payment-status' : !path.length ? 'quote' : 'payment-request';
    if (path.length > 2) throw new AppError(404, 'NOT_FOUND', 'Unknown service action');
    if (req.method === 'GET' && path.length === 1 && ['setup', 'setup-check'].includes(path[0])) {
      if (actor.role !== 'owner')
        throw new AppError(
          403,
          'OWNER_REQUIRED',
          'Administrator integration settings are private. Use your wallet checkout compatibility check.',
        );
      await rateLimit(tenantId + ':service-setup', 15);
      return NextResponse.json(await serviceSetup(path[0] === 'setup-check'), {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    if (req.method === 'GET' && path.length === 1 && path[0] === 'preflight') {
      await rateLimit(tenantId + ':service-preflight', 15);
      if (actor.role !== 'owner') await rateLimit('service:public-provider-reads', 200);
      return NextResponse.json(
        await servicePreflight({
          payer: actor.role === 'member' ? actor.walletAddress || undefined : undefined,
        }),
        {
          headers: { 'Cache-Control': 'private, no-store' },
        },
      );
    }
    if (req.method === 'GET' && path.length)
      throw new AppError(
        405,
        'METHOD',
        'Service actions require an authenticated, origin-checked POST.',
      );
    if (req.method === 'GET' && !path.length)
      return NextResponse.json(
        {
          configured: serviceReady() && (actor.role === 'owner' || publicServiceEnabled()),
          network: serviceMode(),
          mainnetImplemented: true,
          mainnetEnabled: serviceMode() === 'sui:mainnet' && serviceSettlementEnabled(tenantId),
          signingAllowed: serviceSettlementEnabled(tenantId),
          audience: actor.role === 'member' ? 'customer' : 'owner',
          publicPilot: await publicServiceExposure(),
          capabilities: walletOperationPolicy(),
          preparationAllowed: servicePreparationAllowed(tenantId),
          securityCleared: serviceWalletSigningAllowed(),
          sessionCapAtomic: SERVICE_SESSION_CAP,
          exposure: await serviceExposure(tenantId, actor?.sessionKey),
          dedicatedPayer:
            actor.role === 'member'
              ? actor.walletAddress
              : serviceAddressSchema.safeParse(process.env.SERVICE_PAYMENT_PAYER).success
                ? process.env.SERVICE_PAYMENT_PAYER
                : null,
          intents: await listServiceIntents(tenantId),
        },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    let size = 0;
    const chunks: Uint8Array[] = [];
    const reader = req.body?.getReader();
    if (reader)
      while (true) {
        const p = await reader.read();
        if (p.done) break;
        size += p.value.byteLength;
        if (size > 40000) {
          await reader.cancel();
          throw new AppError(413, 'BODY_SIZE', 'Payment payload too large.');
        }
        chunks.push(p.value);
      }
    const data = size ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    if (!path.length) {
      if (actor.role !== 'owner') {
        await rateLimit('service:public-quotes', 100);
        await rateLimit(tenantId + ':public-quotes', 8);
      }
      const input = z
        .object({ invoiceId: z.string().uuid(), operationKey: z.string().uuid() })
        .parse(data);
      const intent = await quoteService(tenantId, input.invoiceId, input.operationKey);
      return NextResponse.json(
        { id: intent.id, expiresAt: intent.expiresAt, ...(intent.challenge as object) },
        {
          status: 402,
          headers: {
            'PAYMENT-REQUIRED': Buffer.from(JSON.stringify(intent.challenge)).toString('base64'),
            'Cache-Control': 'private, no-store',
          },
        },
      );
    }
    const id = z.string().uuid().parse(path[0]);
    stage =
      path[1] === 'approve'
        ? 'terms-approval'
        : path[1] === 'cancel'
          ? 'quote-cancellation'
          : path[1] === 'resume'
            ? 'payment-resume'
            : path[1] === 'events'
              ? 'wallet-diagnostic'
              : path[1] === 'remember'
                ? 'memory-consent'
                : 'settlement-request';
    if (path[1] === 'cancel') return NextResponse.json(await cancelService(tenantId, id));
    if (path[1] === 'approve') {
      const input = z
        .object({
          payer: serviceAddressSchema,
          approved: z.literal(true),
          transaction: z
            .string()
            .min(20)
            .max(20000)
            .regex(/^[A-Za-z0-9+/=]+$/),
        })
        .strict()
        .parse(data);
      return NextResponse.json(
        await approveService(tenantId, id, input.payer, actor?.sessionKey, input.transaction),
      );
    }
    if (path[1] === 'events') {
      const input = z
        .object({
          phase: z.enum(['requested', 'error', 'signed']),
          preparedDigest: z.string().min(32).max(64),
          code: z.string().max(60).optional(),
          message: z.string().max(500).optional(),
        })
        .strict()
        .parse(data);
      return NextResponse.json(
        await recordServiceWalletEvent(tenantId, id, input, actor?.sessionKey),
      );
    }
    if (path[1] === 'remember') {
      const input = z
        .object({ consent: z.literal(true) })
        .strict()
        .parse(data);
      return NextResponse.json(await rememberService(tenantId, id, input.consent));
    }
    if (path[1] && path[1] !== 'resume')
      throw new AppError(404, 'NOT_FOUND', 'Unknown service action');
    const paymentHeader = req.headers.get('PAYMENT-SIGNATURE');
    let payment: unknown =
      data && typeof data === 'object' && 'x402Version' in data ? data : undefined;
    if (paymentHeader) {
      if (data && typeof data === 'object' && 'x402Version' in data)
        throw new AppError(
          400,
          'AMBIGUOUS_PAYMENT',
          'Supply the payment through one transport only.',
        );
      try {
        payment = decodeServicePaymentHeader(paymentHeader);
      } catch {
        throw new AppError(
          400,
          'PAYMENT_HEADER',
          'Invalid PAYMENT-SIGNATURE header. Nothing submitted.',
        );
      }
    }
    const result = await fulfillService(
      tenantId,
      id,
      path[1] === 'resume' ? undefined : payment,
      actor?.sessionKey,
    );
    if (!path[1] && ['quoted', 'approved'].includes(result.state)) {
      const intent = await ownedService(tenantId, id);
      return NextResponse.json(
        { id, expiresAt: intent.expiresAt, ...(intent.challenge as object) },
        {
          status: 402,
          headers: {
            'PAYMENT-REQUIRED': Buffer.from(JSON.stringify(intent.challenge)).toString('base64'),
            'Cache-Control': 'private, no-store',
          },
        },
      );
    }
    return NextResponse.json(
      { ...result, progress: await serviceProgress(tenantId, id, actor?.sessionKey) },
      {
        status: result.state === 'pending' ? 202 : 200,
        headers: {
          'Cache-Control': 'private, no-store',
          ...(result.state === 'settled'
            ? {
                'PAYMENT-RESPONSE': Buffer.from(
                  JSON.stringify({
                    success: true,
                    network: result.receipt?.network,
                    transaction: result.receipt?.digest,
                  }),
                ).toString('base64'),
              }
            : {}),
        },
      },
    );
  } catch (e) {
    if (!(e instanceof z.ZodError)) {
      const failure = requestFailure(e, stage);
      if (failure.status >= 500)
        console.error('PayGuard payment request failed', failure.diagnostic);
      return NextResponse.json(failure, {
        status: failure.status,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    return NextResponse.json(
      {
        error: 'Invalid payment request',
        code: 'INVALID_REQUEST',
      },
      { status: 400 },
    );
  }
}
const scoped: typeof handle = (req, context) => withDatabaseRequest(() => handle(req, context));
export const GET = scoped;
export const POST = scoped;
