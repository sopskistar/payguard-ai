import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner, currentActor, checkOrigin, rateLimit } from '@/lib/auth';
import { AppError, safeError } from '@/lib/errors';
import { serviceWalletSigningAllowed } from '@/lib/wallet-policy';
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
} from '@/lib/service-payments';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
async function handle(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  try {
    if (req.method !== 'GET') checkOrigin(req);
    const tenantId = await requireOwner();
    const actor = await currentActor();
    if (req.method !== 'GET') await rateLimit(tenantId + ':service-payments', 30);
    const path = (await params).path || [];
    if (path.length > 2) throw new AppError(404, 'NOT_FOUND', 'Unknown service action');
    if (req.method === 'GET' && path.length === 1 && ['setup', 'setup-check'].includes(path[0])) {
      await rateLimit(tenantId + ':service-setup', 15);
      return NextResponse.json(await serviceSetup(path[0] === 'setup-check'), {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    if (req.method === 'GET' && path.length === 1 && path[0] === 'preflight') {
      await rateLimit(tenantId + ':service-preflight', 15);
      return NextResponse.json(await servicePreflight(), {
        headers: { 'Cache-Control': 'private, no-store' },
      });
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
          configured: serviceReady(),
          network: serviceMode(),
          mainnetImplemented: true,
          mainnetEnabled: serviceMode() === 'sui:mainnet' && serviceSettlementEnabled(),
          signingAllowed: serviceSettlementEnabled(),
          preparationAllowed: servicePreparationAllowed(),
          securityCleared: serviceWalletSigningAllowed(),
          sessionCapAtomic: SERVICE_SESSION_CAP,
          dedicatedPayer: serviceAddressSchema.safeParse(process.env.SERVICE_PAYMENT_PAYER).success
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
    if (path[1] === 'cancel') return NextResponse.json(await cancelService(tenantId, id));
    if (path[1] === 'approve') {
      const input = z
        .object({ payer: serviceAddressSchema, approved: z.literal(true) })
        .strict()
        .parse(data);
      return NextResponse.json(await approveService(tenantId, id, input.payer, actor?.sessionKey));
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
    return NextResponse.json(result, {
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
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof z.ZodError ? 'Invalid payment request' : safeError(e),
        code:
          e instanceof AppError
            ? e.code
            : e instanceof z.ZodError
              ? 'INVALID_REQUEST'
              : 'SERVICE_UNAVAILABLE',
      },
      { status: e instanceof AppError ? e.status : e instanceof z.ZodError ? 400 : 500 },
    );
  }
}
export const GET = handle;
export const POST = handle;
