import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { and, eq, desc } from 'drizzle-orm';
import { verifyTransactionSignature } from '@mysten/sui/verify';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64 } from '@mysten/sui/utils';
import { db } from '@/db';
import * as s from '@/db/schema';
import { ownedInvoice, audit } from './store';
import { trustContext } from './verify-store';
import { AppError } from './errors';
import {
  SERVICE_NETWORK,
  SERVICE_AMOUNT,
  SERVICE_ASSET,
  SERVICE_SESSION_CAP,
  serviceAddressSchema,
  serviceNetworkInfo,
  type ServiceNetwork,
  FACILITATOR,
  servicePayloadSchema,
  serviceTermsSchema,
  validateServiceTransaction,
  analyzeInstructionConsistency,
  type ServiceChallenge,
} from './service-protocol';
import { inspectServiceSettlement, serviceChainPreflight } from './integrations/service-tatum';
import { recordCorrection } from './integrations/memory';
import { walletOnboardingAllowed, WALLET_REVIEW_MESSAGE } from './wallet-policy';
import { serviceConfiguration } from './service-setup';
export const serviceMode = (): ServiceNetwork =>
  process.env.ENABLE_AGENT_PAYMENTS === 'testnet' ? 'sui:testnet' : SERVICE_NETWORK;
export const serviceReady = () => {
  const config = serviceConfiguration(process.env);
  return (
    ['mainnet', 'testnet'].includes(process.env.ENABLE_AGENT_PAYMENTS || '') &&
    !!config.recipient &&
    !!process.env.TATUM_API_KEY &&
    (serviceMode() !== 'sui:mainnet' || config.partiesValid)
  );
};
export const serviceSettlementEnabled = () =>
  serviceReady() &&
  process.env.SERVICE_PAYMENT_SETTLEMENT_ENABLED === 'true' &&
  walletOnboardingAllowed();
function requireNewSpend() {
  if (!walletOnboardingAllowed())
    throw new AppError(503, 'WALLET_SECURITY_REVIEW', WALLET_REVIEW_MESSAGE);
  if (!serviceSettlementEnabled())
    throw new AppError(
      503,
      'SPENDING_DISABLED',
      'Settlement is disabled. Prepare and approve exact terms before enabling SERVICE_PAYMENT_SETTLEMENT_ENABLED.',
    );
}
function budgetId(tenantId: string, sessionKey: string | undefined, network: string) {
  if (!sessionKey || sessionKey.length < 32)
    throw new AppError(403, 'SPENDING_SESSION', 'An authenticated spending session is required.');
  return createHash('sha256')
    .update(tenantId + ':' + sessionKey + ':' + network)
    .digest('hex');
}
async function facilitator(path: string, body?: unknown) {
  const r = await fetch(FACILITATOR + path, {
    redirect: 'error',
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
export async function servicePreflight() {
  const network = serviceMode();
  const supported = await facilitator('/supported');
  const kind = supported.kinds?.find(
    (k: { network: string; scheme: string; x402Version: number }) =>
      k.network === network && k.scheme === 'exact' && k.x402Version === 2,
  );
  const sponsor = serviceAddressSchema.safeParse(kind?.extra?.gasOwner);
  if (!sponsor.success || kind.extra.gasBudget !== '2000000')
    throw new AppError(
      503,
      'FACILITATOR_TERMS',
      'Selected network or sponsor terms unavailable. No payment proposed.',
    );
  const payer = serviceAddressSchema.safeParse(process.env.SERVICE_PAYMENT_PAYER);
  const recipient = serviceAddressSchema.safeParse(process.env.SERVICE_PAYMENT_RECIPIENT);
  const chain = await serviceChainPreflight(network, {
    payer: payer.success ? payer.data : null,
    recipient: recipient.success ? recipient.data : null,
  });
  const missing = [
    ...(!payer.success ? ['SERVICE_PAYMENT_PAYER'] : []),
    ...(!recipient.success ? ['SERVICE_PAYMENT_RECIPIENT'] : []),
  ];
  const validParties =
    payer.success &&
    recipient.success &&
    payer.data !== recipient.data &&
    payer.data !== sponsor.data &&
    recipient.data !== sponsor.data;
  const sufficientlyFunded =
    !!chain.balances.payer && BigInt(chain.balances.payer.addressAtomic) >= BigInt(SERVICE_AMOUNT);
  return {
    checkedAt: new Date().toISOString(),
    spending: false,
    readyForExactApproval:
      missing.length === 0 && validParties && sufficientlyFunded && walletOnboardingAllowed(),
    configurationReady: missing.length === 0 && validParties,
    sufficientlyFunded,
    missing,
    partiesDistinct: !!validParties,
    payer: payer.success ? payer.data : null,
    recipient: recipient.success ? recipient.data : null,
    network,
    genesis: chain.genesis,
    asset: SERVICE_ASSET,
    decimals: 9,
    amountAtomic: SERVICE_AMOUNT,
    amount: '0.001 SUI',
    sessionCapAtomic: SERVICE_SESSION_CAP,
    provider: 'PayGuard first-party consistency analysis',
    independentThirdPartyPurchase: false,
    resourceOrigin: process.env.APP_URL ? new URL(process.env.APP_URL).origin : null,
    facilitator: FACILITATOR,
    sponsor: sponsor.data,
    maxSponsorGasAtomic: '2000000',
    maxPayerGasAtomic: '0',
    purpose:
      'Analyze contradictory invoice recipient mentions, embedded link domains and instruction-bypass language. Human supplier verification remains required.',
    expectedResult:
      'A persisted consistency report with concrete findings, transaction receipt and unchanged supplier-approval safeguards.',
    risks: [
      'First-party buyer/seller relationship; not independent supplier identity verification.',
      'Facilitator availability, sponsorship and full wallet compatibility remain unproven until an authorized settlement.',
      'Signed transaction can be relayed; cancellation is only available before PayGuard discloses signed bytes to the facilitator.',
      'The five-minute quote limits application submission. Sui timestamp expiry is unsupported; disclosed signed bytes remain relayable through the approved epoch window and cannot be revoked by cancelling a quote.',
      'No service result is released until Tatum independently confirms exact finalized credit.',
    ],
    chain,
    securityCleared: walletOnboardingAllowed(),
    settlementEnabled: serviceSettlementEnabled(),
  };
}
export async function serviceSetup(check = false) {
  const config = serviceConfiguration(process.env);
  const base = {
    ...config,
    network: serviceMode(),
    quoteEnabled: serviceReady(),
    settlementEnabled: serviceSettlementEnabled(),
    securityCleared: walletOnboardingAllowed(),
  };
  if (!check) return { ...base, check: { state: 'unchecked' as const } };
  try {
    const preflight = await servicePreflight();
    return { ...base, check: { state: 'passed' as const, preflight } };
  } catch {
    return {
      ...base,
      check: {
        state: 'failed' as const,
        checkedAt: new Date().toISOString(),
        message:
          'Read-only provider check unavailable. Balances and compatibility are unknown; refresh before preparing any payment.',
      },
    };
  }
}
export type ServiceSetup = Awaited<ReturnType<typeof serviceSetup>>;
function configuredTerms(terms: import('./service-protocol').ServiceTerms, payer: string) {
  if (terms.network !== serviceMode() || terms.payTo !== process.env.SERVICE_PAYMENT_RECIPIENT)
    throw new AppError(
      409,
      'CONFIG_CHANGED',
      'Network or merchant configuration changed. Review a fresh quote.',
    );
  if (terms.network === 'sui:mainnet' && process.env.SERVICE_PAYMENT_PAYER !== payer)
    throw new AppError(
      403,
      'PAYER_ALLOWLIST',
      'Mainnet approval requires the dedicated SERVICE_PAYMENT_PAYER.',
    );
}
export async function quoteService(tenantId: string, invoiceId: string, operationKey: string) {
  if (!serviceReady())
    throw new AppError(
      503,
      'SERVICE_DISABLED',
      'Service quotes require ENABLE_AGENT_PAYMENTS, SERVICE_PAYMENT_RECIPIENT and TATUM_API_KEY. Settlement has a separate disabled-by-default switch.',
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
  if (old) {
    if (old.invoiceId !== invoiceId)
      throw new AppError(
        409,
        'OPERATION_REUSED',
        'This operation already belongs to another invoice.',
      );
    return old;
  }
  const invoice = await ownedInvoice(tenantId, invoiceId);
  const context = await trustContext(tenantId, invoice);
  if (!context.signals.length)
    throw new AppError(
      409,
      'NO_ANALYSIS_NEED',
      'No instruction anomaly currently requires supplemental consistency analysis.',
    );
  const network = serviceMode();
  if (network === 'sui:mainnet') {
    const readiness = await servicePreflight();
    if (!readiness.configurationReady || !readiness.sufficientlyFunded)
      throw new AppError(
        409,
        'PAYMENT_NOT_READY',
        'Mainnet quote requires distinct configured parties and independently checked sufficient address-balance SUI. Open Payment Setup. No signing or payment occurred.',
      );
  }
  const supported = await facilitator('/supported');
  const kind = supported.kinds?.find(
    (k: { x402Version: number; network: string; scheme: string }) =>
      k.x402Version === 2 && k.network === network && k.scheme === 'exact',
  );
  if (!kind)
    throw new AppError(
      503,
      'FACILITATOR_UNSUPPORTED',
      'Facilitator does not advertise the selected x402 v2 exact Sui network. No payment was requested.',
    );
  const id = randomUUID();
  const terms = serviceTermsSchema.parse({
    scheme: 'exact',
    network,
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
    network,
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
export async function approveService(
  tenantId: string,
  id: string,
  payer: string,
  sessionKey?: string,
) {
  requireNewSpend();
  const d = await db();
  return d.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(s.servicePaymentIntents)
      .where(
        and(eq(s.servicePaymentIntents.id, id), eq(s.servicePaymentIntents.tenantId, tenantId)),
      )
      .for('update');
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Service intent not found.');
    const challenge = row.challenge as ServiceChallenge;
    const terms = serviceTermsSchema.parse(challenge.accepts[0]);
    configuredTerms(terms, payer);
    const budget = budgetId(tenantId, sessionKey, terms.network);
    if (
      row.state === 'approved' &&
      row.payer === payer &&
      row.spendingSessionId === budget &&
      row.expiresAt > new Date()
    )
      return { approved: true };
    if (row.expiresAt < new Date() || row.state !== 'quoted' || terms.network !== serviceMode())
      throw new AppError(
        409,
        'QUOTE_STATE',
        'Quote expired or approval already recorded. Resume the existing payment instead.',
      );
    if (payer === terms.payTo || payer === terms.extra.gasOwner)
      throw new AppError(400, 'PAYER', 'Payer must differ from merchant and gas sponsor.');
    await tx
      .insert(s.serviceSpendingSessions)
      .values({
        id: budget,
        tenantId,
        network: terms.network,
        asset: terms.asset,
        payer,
        capAtomic: SERVICE_SESSION_CAP,
      })
      .onConflictDoNothing();
    const [spend] = await tx
      .select()
      .from(s.serviceSpendingSessions)
      .where(
        and(
          eq(s.serviceSpendingSessions.id, budget),
          eq(s.serviceSpendingSessions.tenantId, tenantId),
        ),
      )
      .for('update');
    if (
      !spend ||
      spend.payer !== payer ||
      spend.asset !== terms.asset ||
      BigInt(spend.reservedAtomic) + BigInt(terms.amount) > BigInt(spend.capAtomic)
    )
      throw new AppError(
        409,
        'SESSION_CAP',
        'Session spending cap reached or payer changed. No new payment approved.',
      );
    await tx
      .update(s.serviceSpendingSessions)
      .set({ reservedAtomic: (BigInt(spend.reservedAtomic) + BigInt(terms.amount)).toString() })
      .where(eq(s.serviceSpendingSessions.id, budget));
    const approval = {
      network: terms.network,
      genesis: serviceNetworkInfo(terms.network).genesis,
      asset: terms.asset,
      amountAtomic: terms.amount,
      payer,
      recipient: terms.payTo,
      resource: challenge.resource.url,
      provider: 'PayGuard first-party consistency analysis',
      facilitator: FACILITATOR,
      gasOwner: terms.extra.gasOwner,
      maxSponsorGasAtomic: terms.extra.gasBudget,
      maxPayerGasAtomic: '0',
      purpose: challenge.resource.description,
      sessionCapAtomic: SERVICE_SESSION_CAP,
    };
    await tx
      .update(s.servicePaymentIntents)
      .set({
        state: 'approved',
        payer,
        approvedAt: new Date(),
        spendingSessionId: budget,
        approval,
      })
      .where(eq(s.servicePaymentIntents.id, id));
    await tx
      .insert(s.auditEvents)
      .values({ tenantId, type: 'service.approved', entityId: id, detail: approval });
    return { approved: true };
  });
}
export async function cancelService(tenantId: string, id: string) {
  return (await db()).transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(s.servicePaymentIntents)
      .where(
        and(eq(s.servicePaymentIntents.id, id), eq(s.servicePaymentIntents.tenantId, tenantId)),
      )
      .for('update');
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Service intent not found.');
    if (row.state === 'cancelled') return { state: 'cancelled' };
    if (!['quoted', 'approved'].includes(row.state))
      throw new AppError(
        409,
        'ALREADY_SUBMITTED',
        'A submitted payment cannot be cancelled. Reconcile the existing digest; do not pay again.',
      );
    if (row.state === 'approved' && row.spendingSessionId) {
      const [budget] = await tx
        .select()
        .from(s.serviceSpendingSessions)
        .where(eq(s.serviceSpendingSessions.id, row.spendingSessionId))
        .for('update');
      const terms = serviceTermsSchema.parse((row.challenge as ServiceChallenge).accepts[0]);
      if (
        !budget ||
        budget.tenantId !== tenantId ||
        BigInt(budget.reservedAtomic) < BigInt(terms.amount)
      )
        throw new AppError(409, 'BUDGET_STATE', 'Spending reservation cannot be reconciled.');
      await tx
        .update(s.serviceSpendingSessions)
        .set({ reservedAtomic: (BigInt(budget.reservedAtomic) - BigInt(terms.amount)).toString() })
        .where(eq(s.serviceSpendingSessions.id, budget.id));
    }
    await tx
      .update(s.servicePaymentIntents)
      .set({ state: 'cancelled' })
      .where(eq(s.servicePaymentIntents.id, id));
    await tx
      .insert(s.auditEvents)
      .values({ tenantId, type: 'service.cancelled', entityId: id, detail: { submitted: false } });
    return { state: 'cancelled' };
  });
}
export async function fulfillService(
  tenantId: string,
  id: string,
  raw?: unknown,
  sessionKey?: string,
) {
  let row = await ownedService(tenantId, id);
  const d = await db();
  const [receipt] = await d
    .select()
    .from(s.servicePaymentReceipts)
    .where(
      and(
        eq(s.servicePaymentReceipts.intentId, id),
        eq(s.servicePaymentReceipts.tenantId, tenantId),
      ),
    );
  if (receipt) return { state: 'settled', receipt };
  if (row.state === 'settled')
    throw new AppError(
      409,
      'RECEIPT_MISSING',
      'The owned settlement receipt requires reconciliation. No payment success is assumed.',
    );
  const challenge = row.challenge as ServiceChallenge;
  const terms = serviceTermsSchema.parse(challenge.accepts[0]);

  const invoice = await ownedInvoice(tenantId, row.invoiceId);
  const context = await trustContext(tenantId, invoice);
  if (row.state !== 'settling' && context.instructionHash !== row.instructionHash)
    throw new AppError(
      409,
      'INSTRUCTION_CHANGED',
      'Invoice instructions changed; the old quote cannot fulfill a new review.',
    );
  if (row.state === 'approved') {
    if (raw === undefined)
      return {
        state: 'approved',
        message: 'Exact terms are approved; no signed payment has been submitted.',
      };
    requireNewSpend();
    configuredTerms(terms, row.payer!);
    if (row.spendingSessionId !== budgetId(tenantId, sessionKey, terms.network) || !row.approval)
      throw new AppError(
        403,
        'SPENDING_SESSION',
        'Approve this exact payment in the current authenticated session.',
      );
    if (terms.network !== serviceMode())
      throw new AppError(
        409,
        'NETWORK_CHANGED',
        'Configured payment network changed. Cancel the unsubmitted intent and review a fresh quote.',
      );
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
      { address: row.payer! },
    );
    if (key.toSuiAddress() !== row.payer)
      throw new AppError(400, 'SIGNER', 'Unexpected wallet signer');
    const digest = await Transaction.from(payload.payload.transaction).getDigest();
    const payloadHash = createHash('sha256').update(payload.payload.transaction).digest('hex');
    // Lock before ANY third party receives signed bytes. Cancellation must never release
    // the cap after a signature has left PayGuard, even if /verify times out or rejects it.
    const [claimed] = await d
      .update(s.servicePaymentIntents)
      .set({ state: 'settling', digest, payloadHash })
      .where(and(eq(s.servicePaymentIntents.id, id), eq(s.servicePaymentIntents.state, 'approved')))
      .returning();
    if (!claimed) {
      const current = await ownedService(tenantId, id);
      return {
        state: ['cancelled', 'failed'].includes(current.state) ? current.state : 'pending',
        message:
          current.state === 'cancelled'
            ? 'This unpaid intent was cancelled. Nothing submitted by this request.'
            : 'Another request owns this exact settlement. Resume status.',
      };
    }
    row = claimed;
    try {
      const verify = await facilitator('/verify', {
        x402Version: 2,
        paymentPayload: payload,
        paymentRequirements: terms,
      });
      if (verify.isValid !== true || (verify.payer && verify.payer !== row.payer)) {
        await audit(tenantId, 'service.verification_rejected', id, {
          digest,
          settlementRequested: false,
        });
        return {
          state: 'pending',
          digest,
          message:
            'Facilitator verification was rejected. Signed bytes were disclosed; this attempt stays locked for independent reconciliation. No settlement or service result is assumed.',
        };
      }
    } catch {
      await audit(tenantId, 'service.verification_indeterminate', id, {
        digest,
        settlementRequested: false,
      });
      return {
        state: 'pending',
        digest,
        message:
          'Facilitator verification was interrupted. Resume the existing digest; do not sign or pay again.',
      };
    }
    try {
      const settled = await facilitator('/settle', {
        x402Version: 2,
        paymentPayload: payload,
        paymentRequirements: terms,
      });
      await audit(tenantId, 'service.settlement_response', id, {
        success: settled.success === true,
        digest: row.digest,
        reportedDigest:
          typeof settled.transaction === 'string' ? settled.transaction.slice(0, 100) : null,
        reportedNetwork: typeof settled.network === 'string' ? settled.network.slice(0, 100) : null,
        reportedPayer: typeof settled.payer === 'string' ? settled.payer.slice(0, 100) : null,
        provider: FACILITATOR,
        authoritative: false,
      });
    } catch {
      await audit(tenantId, 'service.settlement_indeterminate', id, {
        digest: row.digest,
        provider: FACILITATOR,
        retrySettlement: false,
      });
      /* Submission can have succeeded. Reconcile the exact digest; never sign a replacement. */
    }
  }
  if (row.state !== 'settling' || !row.digest || !row.payer)
    return {
      state: row.state,
      message:
        row.state === 'failed'
          ? 'Tatum confirmed failed execution. No service receipt or replacement payment was created.'
          : 'Approve the exact terms before signing.',
    };
  let evidence;
  try {
    evidence = await inspectServiceSettlement(row.digest, terms, row.payer);
  } catch (error) {
    if (error instanceof AppError && error.code === 'SETTLEMENT_FAILED') {
      await d
        .update(s.servicePaymentIntents)
        .set({ state: 'failed' })
        .where(
          and(
            eq(s.servicePaymentIntents.id, id),
            eq(s.servicePaymentIntents.tenantId, tenantId),
            eq(s.servicePaymentIntents.state, 'settling'),
          ),
        );
      await audit(tenantId, 'service.failed', id, {
        digest: row.digest,
        source: 'Tatum finalized execution status',
        noServiceReceipt: true,
      });
      return { state: 'failed', digest: row.digest, message: error.message };
    }
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
    if (!r) {
      const [existing] = await tx
        .select()
        .from(s.servicePaymentReceipts)
        .where(
          and(
            eq(s.servicePaymentReceipts.intentId, id),
            eq(s.servicePaymentReceipts.tenantId, tenantId),
          ),
        );
      if (!existing)
        throw new AppError(
          409,
          'RECEIPT_CONFLICT',
          'A settlement receipt conflict requires reconciliation. No service success assumed.',
        );
      return existing;
    }
    await tx
      .update(s.servicePaymentIntents)
      .set({ state: 'settled' })
      .where(
        and(eq(s.servicePaymentIntents.id, id), eq(s.servicePaymentIntents.tenantId, tenantId)),
      );
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
    receipt: saved,
  };
}
export async function rememberService(tenantId: string, id: string) {
  const row = await ownedService(tenantId, id);
  const [receipt] = await (
    await db()
  )
    .select()
    .from(s.servicePaymentReceipts)
    .where(
      and(
        eq(s.servicePaymentReceipts.intentId, id),
        eq(s.servicePaymentReceipts.tenantId, tenantId),
      ),
    );
  if (!receipt || row.state !== 'settled')
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
    .orderBy(desc(s.servicePaymentIntents.createdAt), desc(s.servicePaymentIntents.id))
    .limit(30);
}
