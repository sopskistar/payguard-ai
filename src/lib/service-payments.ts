import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { verifyTransactionSignature } from '@mysten/sui/verify';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64 } from '@mysten/sui/utils';
import { db } from '@/db';
import * as s from '@/db/schema';
import { ownedInvoice, audit } from './store';
import { trustContext } from './verify-store';
import { AppError } from './errors';
import { address } from './validation';
import {
  SERVICE_NETWORK,
  SERVICE_AMOUNT,
  SERVICE_ASSET,
  FACILITATOR,
  servicePayloadSchema,
  serviceTermsSchema,
  validateServiceTransaction,
  analyzeInstructionConsistency,
  type ServiceChallenge,
} from './service-protocol';
import { inspectServiceSettlement } from './integrations/service-tatum';
import { recordCorrection } from './integrations/memory';
export const serviceReady = () =>
  process.env.ENABLE_AGENT_PAYMENTS === 'testnet' &&
  address.safeParse(process.env.SERVICE_PAYMENT_RECIPIENT).success &&
  !!process.env.TATUM_API_KEY;
async function facilitator(path: string, body?: unknown) {
  const r = await fetch(FACILITATOR + path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok)
    throw new AppError(
      502,
      'FACILITATOR_UNAVAILABLE',
      'Service facilitator unavailable. No settlement assumed; resume the existing intent.',
    );
  return r.json();
}
export async function quoteService(tenantId: string, invoiceId: string, operationKey: string) {
  if (!serviceReady())
    throw new AppError(
      503,
      'SERVICE_DISABLED',
      'Testnet service payments require ENABLE_AGENT_PAYMENTS, SERVICE_PAYMENT_RECIPIENT and TATUM_API_KEY. Mainnet payments are disabled.',
    );
  const d = await db();
  const [old] = await d
    .select()
    .from(s.servicePaymentIntents)
    .where(
      and(
        eq(s.servicePaymentIntents.tenantId, tenantId),
        eq(s.servicePaymentIntents.operationKey, operationKey),
      ),
    );
  if (old) return old;
  const invoice = await ownedInvoice(tenantId, invoiceId);
  const context = await trustContext(tenantId, invoice);
  if (!context.signals.length)
    throw new AppError(
      409,
      'NO_ANALYSIS_NEED',
      'No instruction anomaly currently requires supplemental consistency analysis.',
    );
  const supported = await facilitator('/supported');
  const kind = supported.kinds?.find(
    (k: { network: string; scheme: string }) =>
      k.network === SERVICE_NETWORK && k.scheme === 'exact',
  );
  const id = randomUUID();
  const terms = serviceTermsSchema.parse({
    scheme: 'exact',
    network: SERVICE_NETWORK,
    asset: SERVICE_ASSET,
    amount: SERVICE_AMOUNT,
    payTo: process.env.SERVICE_PAYMENT_RECIPIENT,
    maxTimeoutSeconds: 300,
    extra: {
      gasOwner: kind?.extra?.gasOwner,
      gasBudget: '2000000',
      quoteId: id,
      instructionHash: context.instructionHash,
    },
  });
  if (kind?.extra?.gasBudget !== terms.extra.gasBudget)
    throw new AppError(503, 'GAS_TERMS', 'Facilitator gas terms changed; owner review required.');
  const challenge: ServiceChallenge = {
    x402Version: 2,
    resource: {
      url: new URL('/api/service-payments/' + id, process.env.APP_URL!).toString(),
      description: 'First-party invoice consistency analysis; does not verify supplier identity.',
      mimeType: 'application/json',
    },
    accepts: [terms],
  };
  const [intent] = await d
    .insert(s.servicePaymentIntents)
    .values({
      id,
      tenantId,
      invoiceId,
      operationKey,
      instructionHash: context.instructionHash,
      analysisInput: {
        recipient: invoice.recipient,
        memo: invoice.memo,
        message: context.instruction?.message || '',
      },
      challenge,
      expiresAt: new Date(Date.now() + 300000),
    })
    .returning();
  await audit(tenantId, 'service.challenge', id, {
    network: SERVICE_NETWORK,
    amountAtomic: SERVICE_AMOUNT,
    firstParty: true,
    need: context.signals.map((f) => f.id),
  });
  return intent;
}
export async function ownedService(tenantId: string, id: string) {
  const [row] = await (
    await db()
  )
    .select()
    .from(s.servicePaymentIntents)
    .where(and(eq(s.servicePaymentIntents.tenantId, tenantId), eq(s.servicePaymentIntents.id, id)));
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Service intent not found.');
  return row;
}
export async function approveService(tenantId: string, id: string, payer: string) {
  const row = await ownedService(tenantId, id);
  const challenge = row.challenge as ServiceChallenge;
  if (row.state === 'approved' && row.payer === payer && row.expiresAt > new Date())
    return { approved: true };
  if (!serviceReady() || row.expiresAt < new Date() || row.state !== 'quoted')
    throw new AppError(
      409,
      'QUOTE_STATE',
      'Quote expired or approval already recorded. Resume the existing payment instead.',
    );
  if (payer === challenge.accepts[0].payTo || payer === challenge.accepts[0].extra.gasOwner)
    throw new AppError(400, 'PAYER', 'Payer must differ from merchant and gas sponsor.');
  await (
    await db()
  )
    .update(s.servicePaymentIntents)
    .set({ state: 'approved', payer, approvedAt: new Date() })
    .where(and(eq(s.servicePaymentIntents.id, id), eq(s.servicePaymentIntents.state, 'quoted')));
  await audit(tenantId, 'service.approved', id, {
    network: SERVICE_NETWORK,
    amountAtomic: SERVICE_AMOUNT,
    purpose: challenge.resource.description,
    payer,
    recipient: challenge.accepts[0].payTo,
  });
  return { approved: true };
}
export async function fulfillService(tenantId: string, id: string, raw?: unknown) {
  let row = await ownedService(tenantId, id);
  const d = await db();
  const [receipt] = await d
    .select()
    .from(s.servicePaymentReceipts)
    .where(eq(s.servicePaymentReceipts.intentId, id));
  if (receipt) return { state: 'settled', receipt };
  const challenge = row.challenge as ServiceChallenge;
  const terms = serviceTermsSchema.parse(challenge.accepts[0]);
  if (!serviceReady())
    throw new AppError(
      503,
      'SERVICE_DISABLED',
      'Service settlement disabled. No Mainnet payment is supported.',
    );
  const invoice = await ownedInvoice(tenantId, row.invoiceId);
  const context = await trustContext(tenantId, invoice);
  if (row.state !== 'settling' && context.instructionHash !== row.instructionHash)
    throw new AppError(
      409,
      'INSTRUCTION_CHANGED',
      'Invoice instructions changed; the old quote cannot fulfill a new review.',
    );
  if (row.state === 'approved') {
    if (row.expiresAt < new Date())
      throw new AppError(409, 'QUOTE_EXPIRED', 'Quote expired; nothing was submitted.');
    const payload = servicePayloadSchema.parse(raw);
    if (
      JSON.stringify(payload.accepted) !== JSON.stringify(terms) ||
      payload.resource.url !== challenge.resource.url
    )
      throw new AppError(
        400,
        'TERMS_CHANGED',
        'Signed payment terms differ from the approved quote.',
      );
    validateServiceTransaction(payload.payload.transaction, terms, row.payer!);
    const key = await verifyTransactionSignature(
      fromBase64(payload.payload.transaction),
      payload.payload.signature,
    );
    if (key.toSuiAddress() !== row.payer)
      throw new AppError(400, 'SIGNER', 'Unexpected wallet signer');
    const digest = await Transaction.from(payload.payload.transaction).getDigest();
    const payloadHash = createHash('sha256').update(payload.payload.transaction).digest('hex');
    // Reserve the unique proof BEFORE asking the facilitator to settle. Concurrent requests cannot charge twice.
    const verify = await facilitator('/verify', {
      x402Version: 2,
      paymentPayload: payload,
      paymentRequirements: terms,
    });
    if (verify.isValid !== true)
      throw new AppError(
        400,
        'PAYMENT_INVALID',
        'Facilitator rejected payment authorization. Nothing was submitted by PayGuard.',
      );
    const [claimed] = await d
      .update(s.servicePaymentIntents)
      .set({ state: 'settling', digest, payloadHash })
      .where(and(eq(s.servicePaymentIntents.id, id), eq(s.servicePaymentIntents.state, 'approved')))
      .returning();
    if (!claimed)
      return {
        state: 'pending',
        message: 'Another request owns this exact settlement. Resume status.',
      };
    row = claimed;
    try {
      const settled = await facilitator('/settle', {
        x402Version: 2,
        paymentPayload: payload,
        paymentRequirements: terms,
      });
      await audit(tenantId, 'service.settlement_response', id, {
        success: settled.success === true,
        digest: row.digest,
        reportedDigest: settled.transaction || null,
      });
    } catch {
      /* Submission can have succeeded. Reconcile the exact digest; never sign a replacement. */
    }
  }
  if (row.state !== 'settling' || !row.digest || !row.payer)
    return { state: row.state, message: 'Approve the exact terms before signing.' };
  let evidence;
  try {
    evidence = await inspectServiceSettlement(row.digest, terms, row.payer);
  } catch {
    return {
      state: 'pending',
      digest: row.digest,
      message:
        'Settlement has not been independently confirmed by Tatum. Resume this intent; no result or payment success is assumed.',
    };
  }
  const frozen = row.analysisInput as { recipient: string; memo: string; message: string };
  const result = {
    ...analyzeInstructionConsistency(frozen, frozen.message),
    instructionChangedSinceQuote: context.instructionHash !== row.instructionHash,
  };
  const saved = await d.transaction(async (tx) => {
    const [r] = await tx
      .insert(s.servicePaymentReceipts)
      .values({
        tenantId,
        intentId: id,
        digest: row.digest!,
        network: terms.network,
        evidence,
        result,
      })
      .onConflictDoNothing()
      .returning();
    await tx
      .update(s.servicePaymentIntents)
      .set({ state: 'settled' })
      .where(eq(s.servicePaymentIntents.id, id));
    await tx.insert(s.auditEvents).values({
      tenantId,
      type: 'service.review_completed',
      entityId: invoice.id,
      detail: {
        intentId: id,
        digest: row.digest,
        firstParty: true,
        recommendation: result.recommendation,
        supplierApprovalUnchanged: true,
      },
    });
    return r;
  });
  return {
    state: 'settled',
    receipt:
      saved ||
      (
        await d
          .select()
          .from(s.servicePaymentReceipts)
          .where(eq(s.servicePaymentReceipts.intentId, id))
      )[0],
  };
}
export async function rememberService(tenantId: string, id: string) {
  const row = await ownedService(tenantId, id);
  const [receipt] = await (
    await db()
  )
    .select()
    .from(s.servicePaymentReceipts)
    .where(eq(s.servicePaymentReceipts.intentId, id));
  if (!receipt)
    throw new AppError(409, 'NO_SETTLEMENT', 'A Tatum-confirmed service receipt is required.');
  return recordCorrection(tenantId, {
    invoiceId: row.invoiceId,
    findingId: 'service-consistency-review',
    action: 'remember',
    explanation:
      'A first-party paid consistency review reinforced independent recipient verification. Service settlement and supplier identity are separate.',
    scope: 'vendor',
    future: true,
    kind: 'verify_address',
    value: '',
    hard: false,
    consent: true,
    operationKey: id,
  });
}

export async function listServiceIntents(tenantId: string) {
  return (await db())
    .select({
      id: s.servicePaymentIntents.id,
      invoiceId: s.servicePaymentIntents.invoiceId,
      challenge: s.servicePaymentIntents.challenge,
      state: s.servicePaymentIntents.state,
      digest: s.servicePaymentIntents.digest,
      expiresAt: s.servicePaymentIntents.expiresAt,
    })
    .from(s.servicePaymentIntents)
    .where(eq(s.servicePaymentIntents.tenantId, tenantId))
    .limit(30);
}
