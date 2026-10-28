import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner, checkOrigin, rateLimit } from '@/lib/auth';
import { AppError, safeError } from '@/lib/errors';
import { address } from '@/lib/validation';
import {
  serviceReady,
  listServiceIntents,
  quoteService,
  approveService,
  fulfillService,
  rememberService,
} from '@/lib/service-payments';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
async function handle(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  try {
    if (req.method !== 'GET') checkOrigin(req);
    const tenantId = await requireOwner();
    if (req.method !== 'GET') await rateLimit(tenantId + ':service-payments', 30);
    const path = (await params).path || [];
    if (req.method === 'GET' && path.length)
      throw new AppError(
        405,
        'METHOD',
        'Service actions require an authenticated, origin-checked POST.',
      );
    if (req.method === 'GET' && !path.length)
      return NextResponse.json({
        configured: serviceReady(),
        network: 'sui:testnet',
        mainnetEnabled: false,
        intents: await listServiceIntents(tenantId),
      });
    let size = 0;
    const chunks: Uint8Array[] = [];
    const reader = req.body?.getReader();
    if (reader)
      while (true) {
        const p = await reader.read();
        if (p.done) break;
        size += p.value.byteLength;
        if (size > 20000) {
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
    if (path[1] === 'approve') {
      const input = z.object({ payer: address, approved: z.literal(true) }).parse(data);
      return NextResponse.json(await approveService(tenantId, id, input.payer));
    }
    if (path[1] === 'remember') {
      z.object({ consent: z.literal(true) }).parse(data);
      return NextResponse.json(await rememberService(tenantId, id));
    }
    if (path[1] && path[1] !== 'resume')
      throw new AppError(404, 'NOT_FOUND', 'Unknown service action');
    const result = await fulfillService(tenantId, id, path[1] === 'resume' ? undefined : data);
    return NextResponse.json(result, {
      status: result.state === 'pending' ? 202 : 200,
      headers: {
        'Cache-Control': 'private, no-store',
        ...(result.state === 'settled'
          ? {
              'PAYMENT-RESPONSE': Buffer.from(
                JSON.stringify({
                  success: true,
                  network: 'sui:testnet',
                  transaction: result.receipt?.digest,
                }),
              ).toString('base64'),
            }
          : {}),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof z.ZodError ? 'Invalid payment request' : safeError(e) },
      { status: e instanceof AppError ? e.status : e instanceof z.ZodError ? 400 : 500 },
    );
  }
}
export const GET = handle;
export const POST = handle;
