import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { and, eq, desc, inArray, or } from 'drizzle-orm';
import { Transaction } from '@mysten/sui/transactions';
import { db } from '@/db';
import { OWNER_ID } from './demo';
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
import {
  inspectServiceSettlement,
  serviceChainPreflight,
  verifyServiceCoinFunding,
} from './integrations/service-tatum';
import { verifyServiceSignature } from './integrations/service-signature';
import { serviceSigningState } from './service-recovery';
import { assessServiceExpiry, EXPIRY_RULES, type ServiceExpiryWindow } from './service-expiry';
import { readServiceExpiryEvidence } from './integrations/service-expiry';
import { recordCorrection } from './integrations/memory';
import { serviceWalletSigningAllowed, WALLET_REVIEW_MESSAGE } from './wallet-policy';
import { serviceDiagnostic } from './service-diagnostics';
import {
  serviceConfiguration,
  PaymentCheckError,
  paymentCheck,
  failedPaymentCheck,
  type PaymentDiagnostic,
} from './service-setup';
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
export const PUBLIC_SERVICE_CAP = '20000000'; // Limited pilot: at most 20 reserved/settled purchases.
export const publicServiceEnabled = () => process.env.PUBLIC_SERVICE_PAYMENTS_ENABLED !== 'false';
export const serviceSettlementEnabled = (tenantId = OWNER_ID) =>
  serviceReady() &&
  (tenantId === OWNER_ID
    ? process.env.SERVICE_PAYMENT_SETTLEMENT_ENABLED === 'true'
    : publicServiceEnabled()) &&
  serviceWalletSigningAllowed();
export const servicePreparationAllowed = (tenantId = OWNER_ID) =>
  serviceReady() &&
  serviceWalletSigningAllowed() &&
  (tenantId === OWNER_ID || publicServiceEnabled());
function requireNewSpend(tenantId: string) {
  if (!serviceWalletSigningAllowed())
    throw new AppError(503, 'WALLET_SECURITY_REVIEW', WALLET_REVIEW_MESSAGE);
  if (!serviceSettlementEnabled(tenantId))
    throw new AppError(
      503,
      'SPENDING_DISABLED',
      'New settlement is paused by server configuration. You can inspect saved payments without signing or submitting again.',
    );
}
function budgetId(tenantId: string, sessionKey: string | undefined, network: string) {
  if (!sessionKey || sessionKey.length < 32)
    throw new AppError(403, 'SPENDING_SESSION', 'An authenticated spending session is required.');
  if (tenantId !== OWNER_ID) return walletBudgetId(tenantId, network);
  return createHash('sha256')
    .update(tenantId + ':' + sessionKey + ':' + network)
    .digest('hex');
}
const walletBudgetId = (tenantId: string, network: string) =>
  createHash('sha256')
    .update(tenantId + ':authenticated-wallet-pilot-v1:' + network)
    .digest('hex');
async function checkoutPayer(tenantId: string) {
  if (tenantId === OWNER_ID) return process.env.SERVICE_PAYMENT_PAYER;
  const [user] = await (
    await db()
  )
    .select({ wallet: s.users.walletAddress, role: s.users.role })
    .from(s.users)
    .where(eq(s.users.id, tenantId));
  if (!user?.wallet || user.role !== 'member')
    throw new AppError(
      403,
      'WALLET_AUTH_REQUIRED',
      'Authenticate your own Sui wallet before purchasing analysis.',
    );
  return serviceAddressSchema.parse(user.wallet);
}
const pilotBudgetId = (network = serviceMode()) =>
  createHash('sha256')
    .update('payguard:public-sponsored-pilot:v1:' + network)
    .digest('hex');
export async function publicServiceExposure() {
  const [row] = await (
    await db()
  )
    .select({ reservedAtomic: s.serviceSpendingSessions.reservedAtomic })
    .from(s.serviceSpendingSessions)
    .where(eq(s.serviceSpendingSessions.id, pilotBudgetId()));
  return {
    reservedAtomic: row?.reservedAtomic || '0',
    capAtomic: PUBLIC_SERVICE_CAP,
    purchases: 20,
    walletCapAtomic: SERVICE_SESSION_CAP,
  };
}
export async function serviceExposure(tenantId: string, sessionKey?: string) {
  if (!sessionKey && tenantId === OWNER_ID)
    return { reservedAtomic: '0', capAtomic: SERVICE_SESSION_CAP };
  const [row] = await (
    await db()
  )
    .select({ reservedAtomic: s.serviceSpendingSessions.reservedAtomic })
    .from(s.serviceSpendingSessions)
    .where(
      and(
        eq(s.serviceSpendingSessions.tenantId, tenantId),
        eq(
          s.serviceSpendingSessions.id,
          tenantId === OWNER_ID
            ? budgetId(tenantId, sessionKey, serviceMode())
            : walletBudgetId(tenantId, serviceMode()),
        ),
      ),
    );
  return { reservedAtomic: row?.reservedAtomic || '0', capAtomic: SERVICE_SESSION_CAP };
}
async function facilitator(path: string, body?: unknown) {
  const r = await fetch(FACILITATOR + path, {
    redirect: 'error',
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok && path === '/supported')
    throw Object.assign(new Error('Read-only facilitator request failed'), { status: r.status });
  const response = await r.json().catch(() => null);
  if (!r.ok) {
    const detail = serviceDiagnostic('tentacle' + path, response, serverSecrets());
    throw new AppError(
      502,
      'FACILITATOR_HTTP_' + r.status,
      `Tentacle ${path} HTTP ${r.status}: ${detail.message}`,
    );
  }
  if (!response || typeof response !== 'object')
    throw new AppError(
      502,
      'FACILITATOR_RESPONSE',
      'Tentacle returned an invalid response. Resume the original digest; no settlement assumed.',
    );
  return response;
}
const serverSecrets = () =>
  Object.entries(process.env)
    .filter(([k]) => /PASSWORD|SECRET|PRIVATE_KEY|API_KEY|DATABASE_URL/.test(k))
    .map(([, v]) => v || '');
type PreparedService = { bytes: string; digest: string; preparedAt: string };
const storedPreparation = (approval: unknown) =>
  (approval as { prepared?: PreparedService } | null)?.prepared;
type IntentReader = Pick<Awaited<ReturnType<typeof db>>, 'select'>;
export async function serviceRecoveryHolds(tenantId: string, reader?: IntentReader) {
  if (serviceMode() !== 'sui:mainnet') return [];
  const rows = await (reader || (await db()))
    .select({
      id: s.servicePaymentIntents.id,
      state: s.servicePaymentIntents.state,
      approval: s.servicePaymentIntents.approval,
      challenge: s.servicePaymentIntents.challenge,
      digest: s.servicePaymentIntents.digest,
      payloadHash: s.servicePaymentIntents.payloadHash,
    })
    .from(s.servicePaymentIntents)
    .where(
      and(
        eq(s.servicePaymentIntents.tenantId, tenantId),
        inArray(s.servicePaymentIntents.state, ['approved', 'settling']),
      ),
    );
  return rows
    .filter(
      (row) =>
        (row.challenge as ServiceChallenge).accepts[0].network === 'sui:mainnet' &&
        (storedPreparation(row.approval) ||
          row.digest ||
          row.payloadHash ||
          row.state === 'settling'),
    )
    .map((row) => ({ id: row.id, digest: storedPreparation(row.approval)?.digest || row.digest }));
}
async function requireNoOtherServiceAttempt(tenantId: string, id?: string, reader?: IntentReader) {
  if ((await serviceRecoveryHolds(tenantId, reader)).some((row) => row.id !== id))
    throw new AppError(
      409,
      'PREVIOUS_PAYMENT_UNRESOLVED',
      'An earlier prepared or submitted Mainnet payment requires reconciliation. Do not request another signature or replacement payment. Quote expiry does not revoke a signed transaction.',
    );
}
export async function servicePreflight(options: { allowPartial?: boolean; payer?: string } = {}) {
  const network = serviceMode();
  const diagnostics: PaymentDiagnostic[] = [];
  const config = serviceConfiguration(process.env);
  await paymentCheck(
    diagnostics,
    'configuration',
    'Deployed read-only payment configuration',
    async () => {
      if (!config.partiesValid || !process.env.TATUM_API_KEY || !process.env.APP_URL)
        throw new PaymentCheckError('CONFIGURATION');
      new URL(process.env.APP_URL);
      return true;
    },
  );
  const sponsor = await paymentCheck(
    diagnostics,
    'tentacle.supported',
    'Tentacle x402 v2 exact sponsorship',
    async () => {
      const supported = await facilitator('/supported');
      const kind = (Array.isArray(supported.kinds) ? supported.kinds : []).find(
        (k: { network: string; scheme: string; x402Version: number }) =>
          k.network === network && k.scheme === 'exact' && k.x402Version === 2,
      );
      const address = serviceAddressSchema.safeParse(kind?.extra?.gasOwner);
      if (!address.success || kind?.extra?.gasBudget !== '2000000')
        throw new PaymentCheckError('FACILITATOR_TERMS');
      return address.data;
    },
  );
  const payer = serviceAddressSchema.safeParse(options.payer || process.env.SERVICE_PAYMENT_PAYER);
  const recipient = serviceAddressSchema.safeParse(process.env.SERVICE_PAYMENT_RECIPIENT);
  const chain = await serviceChainPreflight(
    network,
    {
      payer: payer.success ? payer.data : null,
      recipient: recipient.success ? recipient.data : null,
    },
    { allowPartial: true },
  );
  diagnostics.push(...(chain.diagnostics || []));
  const missing = [
    ...(!payer.success ? ['SERVICE_PAYMENT_PAYER'] : []),
    ...(!recipient.success ? ['SERVICE_PAYMENT_RECIPIENT'] : []),
  ];
  const validParties =
    payer.success &&
    recipient.success &&
    !!sponsor &&
    payer.data !== recipient.data &&
    payer.data !== sponsor &&
    recipient.data !== sponsor;
  if (sponsor)
    await paymentCheck(
      diagnostics,
      'configuration.parties',
      'Payer, merchant and sponsor separation',
      async () => {
        if (!validParties) throw new PaymentCheckError('CONFIGURATION');
        return true;
      },
    );
  if (!options.allowPartial && diagnostics.some((d) => d.status === 'failed')) {
    const first = diagnostics.find((d) => d.status === 'failed')!;
    throw new AppError(503, first.code, `${first.label}: ${first.message} ${first.action}`);
  }
  const sufficientlyFunded =
    !!chain.balances.payer && BigInt(chain.balances.payer.totalAtomic) >= BigInt(SERVICE_AMOUNT);
  return {
    checkedAt: new Date().toISOString(),
    spending: false,
    diagnostics,
    readyForExactApproval:
      diagnostics.every((d) => d.status === 'passed') &&
      validParties &&
      sufficientlyFunded &&
      serviceWalletSigningAllowed(),
    readyForQuotePreparation:
      diagnostics.every((d) => d.status === 'passed') && validParties && sufficientlyFunded,
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
    supplierIdentityVerified: false,
    resourceOrigin: process.env.APP_URL ? new URL(process.env.APP_URL).origin : null,
    facilitator: FACILITATOR,
    sponsor,
    maxSponsorGasAtomic: '2000000',
    maxPayerGasAtomic: '0',
    fundingCompatibility: {
      mode: 'address-balance-or-owned-coins',
      addressAtomic: chain.balances.payer?.addressAtomic ?? null,
      coinAtomic: chain.balances.payer?.coinAtomic ?? null,
      ordinaryCoinFallback:
        'Supported: exact SUI split from up to 16 owned coins when address balance is insufficient. Coin change remains with the payer. A mixed balance uses only the necessary address withdrawal. No separate deposit or conversion.',
    },
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
    securityCleared: serviceWalletSigningAllowed(),
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
    securityCleared: serviceWalletSigningAllowed(),
  };
  if (!check)
    return {
      ...base,
      check: {
        state: 'unchecked' as const,
        preflight: null,
        diagnostics: [] as PaymentDiagnostic[],
        checkedAt: null,
        message: 'No check requested.',
      },
    };
  try {
    const preflight = await servicePreflight({ allowPartial: true });
    const allPassed = preflight.diagnostics.every((d) => d.status === 'passed');
    const anyBalance = !!preflight.chain.balances.payer || !!preflight.chain.balances.recipient;
    return {
      ...base,
      check: {
        state: allPassed
          ? ('passed' as const)
          : anyBalance
            ? ('partial' as const)
            : ('failed' as const),
        preflight,
        diagnostics: preflight.diagnostics,
        checkedAt: preflight.checkedAt,
        message: allPassed
          ? 'Both wallet balances and provider checks succeeded.'
          : 'Some read-only stages could not be verified. Successful wallet results are preserved below.',
      },
    };
  } catch (error) {
    const diagnostic = failedPaymentCheck('setup', 'Read-only setup check', error);
    return {
      ...base,
      check: {
        state: 'failed' as const,
        preflight: null,
        diagnostics: [diagnostic],
        checkedAt: new Date().toISOString(),
        message: `${diagnostic.message} ${diagnostic.action}`,
      },
    };
  }
}
export type ServiceSetup = Awaited<ReturnType<typeof serviceSetup>>;
function configuredTerms(
  terms: import('./service-protocol').ServiceTerms,
  payer: string,
  expectedPayer = process.env.SERVICE_PAYMENT_PAYER,
) {
  if (terms.network !== serviceMode() || terms.payTo !== process.env.SERVICE_PAYMENT_RECIPIENT)
    throw new AppError(
      409,
      'CONFIG_CHANGED',
      'Network or merchant configuration changed. Review a fresh quote.',
    );
  if (terms.network === 'sui:mainnet' && expectedPayer !== payer)
    throw new AppError(
      403,
      'PAYER_ALLOWLIST',
      'Mainnet approval must use the server-bound authenticated payer.',
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
    if (!['quoted', 'approved'].includes(old.state) || old.expiresAt <= new Date())
      throw new AppError(
        409,
        'EXISTING_INTENT',
        'This operation already has an expired, cancelled or submitted intent. Resume its record; do not reuse it for a new purchase.',
      );
    return old;
  }
  const invoice = await ownedInvoice(tenantId, invoiceId);
  const expectedPayer = await checkoutPayer(tenantId);
  await requireNoOtherServiceAttempt(tenantId);
  if (tenantId !== OWNER_ID && !publicServiceEnabled())
    throw new AppError(
      503,
      'PUBLIC_CHECKOUT_PAUSED',
      'The public sponsored pilot is paused. Saved receipts remain available.',
    );
  if (tenantId !== OWNER_ID) {
    const pilot = await publicServiceExposure();
    if (BigInt(pilot.reservedAtomic) >= BigInt(pilot.capAtomic))
      throw new AppError(
        409,
        'SPONSOR_CAP',
        'All public pilot sponsorship slots are reserved or used. The Courtroom remains free.',
      );
    const wallet = await serviceExposure(tenantId);
    if (BigInt(wallet.reservedAtomic) >= BigInt(wallet.capAtomic))
      throw new AppError(
        409,
        'WALLET_CAP',
        'Your wallet’s 0.003 SUI pilot exposure is reserved or used, including previous sessions. Reopen a saved receipt or use the free Courtroom.',
      );
  }
  const context = await trustContext(tenantId, invoice);
  if (!context.signals.length)
    throw new AppError(
      409,
      'NO_ANALYSIS_NEED',
      'No instruction anomaly currently requires supplemental consistency analysis.',
    );
  const text = invoice.memo + ' ' + (context.instruction?.message || '');
  const hasSupplementalText =
    /0x[a-fA-F0-9]{64}|https?:\/\/|ignore.{0,80}(?:instructions|safety|rules)/i.test(text);
  const network = serviceMode();
  if (network === 'sui:mainnet') {
    const readiness = await servicePreflight({ payer: expectedPayer });
    if (!readiness.configurationReady || !readiness.sufficientlyFunded)
      throw new AppError(
        409,
        'PAYMENT_NOT_READY',
        'The authenticated payer needs at least 0.001 SUI across address balance and ordinary SUI coins. No quote, signature or payment was created. Refresh balances; the public demo remains free.',
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
      ...(tenantId !== OWNER_ID ? { authenticatedPayer: expectedPayer } : {}),
    },
  });
  if (kind?.extra?.gasBudget !== terms.extra.gasBudget)
    throw new AppError(503, 'GAS_TERMS', 'Facilitator gas terms changed; owner review required.');
  const challenge: ServiceChallenge = {
    x402Version: 2,
    resource: {
      url: new URL('/api/service-payments/' + id, process.env.APP_URL!).toString(),
      description: `First-party invoice analysis of ${context.signals
        .slice(0, 3)
        .map((f) => f.id.replaceAll('-', ' '))
        .join(
          ', ',
        )}. ${hasSupplementalText ? '' : 'No extra textual signals to inspect; supplemental purchase is not recommended. '}Does not verify supplier identity.`,
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
  transaction?: string,
) {
  // Exact terms may be reserved before the separate financial capability is enabled.
  // No signed bytes, signature verification or facilitator calls occur during approval.
  if (!serviceWalletSigningAllowed())
    throw new AppError(503, 'WALLET_SECURITY_REVIEW', WALLET_REVIEW_MESSAGE);
  if (!servicePreparationAllowed(tenantId))
    throw new AppError(
      503,
      'SERVICE_DISABLED',
      'Quote configuration is incomplete. No payment was approved.',
    );
  const expectedPayer = await checkoutPayer(tenantId);
  if (tenantId !== OWNER_ID && !publicServiceEnabled())
    throw new AppError(503, 'PUBLIC_CHECKOUT_PAUSED', 'Public checkout is paused.');
  const d = await db();
  return d.transaction(async (tx) => {
    // Serialize Mainnet preparations across tabs and browser sessions for this payer.
    if (serviceMode() === 'sui:mainnet') {
      await tx
        .select({ id: s.users.id })
        .from(s.users)
        .where(eq(s.users.id, tenantId))
        .for('update');
    }
    const [row] = await tx
      .select()
      .from(s.servicePaymentIntents)
      .where(
        and(eq(s.servicePaymentIntents.id, id), eq(s.servicePaymentIntents.tenantId, tenantId)),
      )
      .for('update');
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Service intent not found.');
    await requireNoOtherServiceAttempt(tenantId, id, tx);
    const challenge = row.challenge as ServiceChallenge;
    const terms = serviceTermsSchema.parse(challenge.accepts[0]);
    configuredTerms(terms, payer, expectedPayer);
    if (new URL(challenge.resource.url).origin !== new URL(process.env.APP_URL!).origin)
      throw new AppError(
        409,
        'QUOTE_ORIGIN',
        'This unsigned quote belongs to another application origin. Cancel it and request fresh terms here. Submitted digests can still be reconciled.',
      );
    const budget = budgetId(tenantId, sessionKey, terms.network);
    let prepared: PreparedService | undefined;
    if (transaction) {
      validateServiceTransaction(transaction, terms, payer);
      await verifyServiceCoinFunding(transaction, terms, payer);
      prepared = {
        bytes: transaction,
        digest: await Transaction.from(transaction).getDigest(),
        preparedAt: new Date().toISOString(),
      };
      const previous = storedPreparation(row.approval);
      if (previous && previous.bytes !== transaction)
        throw new AppError(
          409,
          'PREPARED_CHANGED',
          'Prepared bytes are immutable. Resume the existing transaction; do not replace it.',
        );
    }
    if (
      row.state === 'approved' &&
      row.payer === payer &&
      row.spendingSessionId === budget &&
      row.expiresAt > new Date()
    ) {
      if (prepared && !storedPreparation(row.approval)) {
        await tx
          .update(s.servicePaymentIntents)
          .set({ approval: { ...(row.approval as object), prepared } })
          .where(eq(s.servicePaymentIntents.id, id));
        await tx.insert(s.auditEvents).values({
          tenantId,
          type: 'service.prepared',
          entityId: id,
          detail: { preparedDigest: prepared.digest, submitted: false },
        });
      }
      return { approved: true, prepared: storedPreparation(row.approval) || prepared };
    }
    if (row.expiresAt < new Date() || row.state !== 'quoted' || terms.network !== serviceMode())
      throw new AppError(
        409,
        'QUOTE_STATE',
        'Quote expired or approval already recorded. Resume the existing payment instead.',
      );
    if (payer === terms.payTo || payer === terms.extra.gasOwner)
      throw new AppError(400, 'PAYER', 'Payer must differ from merchant and gas sponsor.');
    if (tenantId !== OWNER_ID) {
      await tx
        .insert(s.serviceSpendingSessions)
        .values({
          id: pilotBudgetId(),
          tenantId: OWNER_ID,
          network: terms.network,
          asset: terms.asset,
          payer: 'public-sponsored-pilot-ledger',
          capAtomic: PUBLIC_SERVICE_CAP,
        })
        .onConflictDoNothing();
      const [pilot] = await tx
        .select()
        .from(s.serviceSpendingSessions)
        .where(eq(s.serviceSpendingSessions.id, pilotBudgetId()))
        .for('update');
      if (!pilot || BigInt(pilot.reservedAtomic) + BigInt(terms.amount) > BigInt(pilot.capAtomic))
        throw new AppError(
          409,
          'SPONSOR_CAP',
          'The public pilot’s 20-purchase sponsorship capacity is reserved or used. Reopen an existing receipt or use the free Courtroom.',
        );
      await tx
        .update(s.serviceSpendingSessions)
        .set({ reservedAtomic: (BigInt(pilot.reservedAtomic) + BigInt(terms.amount)).toString() })
        .where(eq(s.serviceSpendingSessions.id, pilot.id));
    }
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
      ...(prepared ? { prepared } : {}),
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
    await tx.insert(s.auditEvents).values({
      tenantId,
      type: 'service.approved',
      entityId: id,
      detail: { ...approval, ...(prepared ? { prepared: { digest: prepared.digest } } : {}) },
    });
    if (prepared)
      await tx.insert(s.auditEvents).values({
        tenantId,
        type: 'service.prepared',
        entityId: id,
        detail: { preparedDigest: prepared.digest, submitted: false },
      });
    return { approved: true, prepared };
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
    const attempts = await tx
      .select({ type: s.auditEvents.type })
      .from(s.auditEvents)
      .where(and(eq(s.auditEvents.tenantId, tenantId), eq(s.auditEvents.entityId, id)));
    const preparedMainnet =
      !!storedPreparation(row.approval) &&
      (row.challenge as ServiceChallenge).accepts[0].network === 'sui:mainnet';
    if (
      preparedMainnet ||
      row.payloadHash ||
      row.digest ||
      attempts.some((e) => e.type.startsWith('service.wallet_'))
    )
      throw new AppError(
        409,
        'SIGNATURE_UNCERTAIN',
        'Prepared Mainnet bytes or a wallet attempt require reconciliation before releasing the reservation. Quote expiry is not transaction revocation; do not request a replacement payment.',
      );
    if (row.state === 'approved' && row.spendingSessionId) {
      const terms = serviceTermsSchema.parse((row.challenge as ServiceChallenge).accepts[0]);
      if (tenantId !== OWNER_ID) {
        const [pilot] = await tx
          .select()
          .from(s.serviceSpendingSessions)
          .where(eq(s.serviceSpendingSessions.id, pilotBudgetId()))
          .for('update');
        if (!pilot || BigInt(pilot.reservedAtomic) < BigInt(terms.amount))
          throw new AppError(409, 'BUDGET_STATE', 'Public reservation requires reconciliation.');
        await tx
          .update(s.serviceSpendingSessions)
          .set({ reservedAtomic: (BigInt(pilot.reservedAtomic) - BigInt(terms.amount)).toString() })
          .where(eq(s.serviceSpendingSessions.id, pilot.id));
      }
      const [budget] = await tx
        .select()
        .from(s.serviceSpendingSessions)
        .where(eq(s.serviceSpendingSessions.id, row.spendingSessionId))
        .for('update');
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
// Explicitly enabled operator procedure, never called by quote/resume/cancel or a timer.
// The HTTP caller must also be authenticated, origin-checked and own this intent.
export async function recoverExpiredService(
  tenantId: string,
  id: string,
): Promise<{
  state: string;
  recovered: boolean;
  reason?: string;
  releasedAtomic: string;
  alreadyRecovered?: boolean;
  preparedDigest?: string;
}> {
  if (process.env.SERVICE_EXPIRED_RECOVERY_ENABLED !== 'true')
    throw new AppError(
      403,
      'RECOVERY_DISABLED',
      'Expired-payment recovery is disabled. Existing holds remain intact.',
    );
  return (await db()).transaction(async (tx) => {
    // Same order as Mainnet approval: authenticated user, intent, public budget, wallet budget.
    const [actor] = await tx.select().from(s.users).where(eq(s.users.id, tenantId)).for('update');
    if (!actor || !['owner', 'member'].includes(actor.role))
      throw new AppError(403, 'WORKSPACE_REQUIRED', 'An authorized private workspace is required.');
    const [row] = await tx
      .select()
      .from(s.servicePaymentIntents)
      .where(
        and(eq(s.servicePaymentIntents.id, id), eq(s.servicePaymentIntents.tenantId, tenantId)),
      )
      .for('update');
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Service intent not found.');
    const events = await tx
      .select()
      .from(s.auditEvents)
      .where(and(eq(s.auditEvents.tenantId, tenantId), eq(s.auditEvents.entityId, id)));
    const prepared = storedPreparation(row.approval);
    const receipts = await tx
      .select({ id: s.servicePaymentReceipts.id })
      .from(s.servicePaymentReceipts)
      .where(
        or(
          eq(s.servicePaymentReceipts.intentId, id),
          eq(s.servicePaymentReceipts.digest, prepared?.digest || ''),
        ),
      );
    const held = async (reason: string, evidence?: unknown) => {
      await tx.insert(s.auditEvents).values({
        tenantId,
        type: 'service.expiry_recovery_held',
        entityId: id,
        detail: {
          reason,
          preparedDigest: prepared?.digest || null,
          evidence: evidence || null,
          releasedAtomic: '0',
        },
      });
      return { state: row.state, recovered: false, reason, releasedAtomic: '0' };
    };
    if (row.state === 'expired-unexecuted') {
      const recovered = events.find((e) => e.type === 'service.expiry_recovered');
      if (!recovered || receipts.length) return held('RECOVERY_RECORD_CONFLICT');
      return { state: row.state, recovered: true, alreadyRecovered: true, releasedAtomic: '0' };
    }
    if (
      receipts.length ||
      row.state !== 'approved' ||
      !prepared ||
      !row.payer ||
      !row.spendingSessionId
    )
      return held('INTENT_NOT_RECOVERABLE');
    if (
      row.digest ||
      row.payloadHash ||
      events.some(
        (e) =>
          e.type.startsWith('service.settlement_') || e.type.startsWith('service.confirmation_'),
      )
    )
      return held('SUBMISSION_REQUIRES_RECONCILIATION');
    const challenge = row.challenge as ServiceChallenge;
    const terms = serviceTermsSchema.parse(challenge.accepts[0]);
    if (
      terms.network !== 'sui:mainnet' ||
      terms.extra.quoteId !== id ||
      (tenantId !== OWNER_ID &&
        (actor.role !== 'member' ||
          actor.walletAddress !== row.payer ||
          (terms.extra.authenticatedPayer && terms.extra.authenticatedPayer !== row.payer) ||
          row.spendingSessionId !== walletBudgetId(tenantId, terms.network)))
    )
      return held('PAYER_OR_NETWORK_MISMATCH');
    let window: ServiceExpiryWindow;
    try {
      validateServiceTransaction(prepared.bytes, terms, row.payer);
      const transaction = Transaction.from(prepared.bytes);
      if ((await transaction.getDigest()) !== prepared.digest)
        return held('PREPARED_DIGEST_MISMATCH');
      const expiration = transaction.getData().expiration;
      if (
        expiration?.$kind !== 'ValidDuring' ||
        expiration.ValidDuring.minEpoch === null ||
        expiration.ValidDuring.maxEpoch === null ||
        expiration.ValidDuring.minTimestamp !== null ||
        expiration.ValidDuring.maxTimestamp !== null
      )
        return held('UNSUPPORTED_VALIDITY');
      window = {
        digest: prepared.digest,
        minEpoch: String(expiration.ValidDuring.minEpoch),
        maxEpoch: String(expiration.ValidDuring.maxEpoch),
      };
    } catch {
      return held('PREPARATION_INVALID');
    }
    const evidence = await readServiceExpiryEvidence(window);
    const decision = assessServiceExpiry(window, evidence);
    if (!decision.eligible) return held(decision.reason, evidence);

    const budgets = [];
    if (tenantId !== OWNER_ID) {
      const [pilot] = await tx
        .select()
        .from(s.serviceSpendingSessions)
        .where(eq(s.serviceSpendingSessions.id, pilotBudgetId(terms.network)))
        .for('update');
      if (!pilot || pilot.tenantId !== OWNER_ID || pilot.payer !== 'public-sponsored-pilot-ledger')
        return held('PUBLIC_BUDGET_CONFLICT', evidence);
      budgets.push({ row: pilot, public: true });
    }
    const [budget] = await tx
      .select()
      .from(s.serviceSpendingSessions)
      .where(eq(s.serviceSpendingSessions.id, row.spendingSessionId))
      .for('update');
    if (!budget || budget.tenantId !== tenantId || budget.payer !== row.payer)
      return held('WALLET_BUDGET_CONFLICT', evidence);
    budgets.push({ row: budget, public: false });
    // Verify the entire liability ledger before subtracting this one reservation.
    // Settled and failed attempts remain counted; only auditable releases are excluded.
    const ledger = await tx.select().from(s.servicePaymentIntents);
    for (const b of budgets) {
      let liability = 0n;
      try {
        for (const item of ledger) {
          if (
            !item.spendingSessionId ||
            item.state === 'cancelled' ||
            item.state === 'expired-unexecuted'
          )
            continue;
          if (b.public ? item.tenantId === OWNER_ID : item.spendingSessionId !== b.row.id) continue;
          const t = serviceTermsSchema.parse((item.challenge as ServiceChallenge).accepts[0]);
          if (t.network !== terms.network) continue;
          if (
            !item.approvedAt ||
            !['approved', 'settling', 'settled', 'failed'].includes(item.state)
          )
            return held('BUDGET_LIABILITY_UNCERTAIN', evidence);
          liability += BigInt(t.amount);
        }
        if (
          b.row.network !== terms.network ||
          b.row.asset !== terms.asset ||
          BigInt(b.row.reservedAtomic) !== liability ||
          liability < BigInt(terms.amount) ||
          liability > BigInt(b.row.capAtomic)
        )
          return held('BUDGET_LIABILITY_CONFLICT', evidence);
      } catch {
        return held('BUDGET_LIABILITY_UNCERTAIN', evidence);
      }
    }
    for (const b of budgets)
      await tx
        .update(s.serviceSpendingSessions)
        .set({ reservedAtomic: (BigInt(b.row.reservedAtomic) - BigInt(terms.amount)).toString() })
        .where(eq(s.serviceSpendingSessions.id, b.row.id));
    await tx
      .update(s.servicePaymentIntents)
      .set({ state: 'expired-unexecuted' })
      .where(
        and(eq(s.servicePaymentIntents.id, id), eq(s.servicePaymentIntents.state, 'approved')),
      );
    await tx.insert(s.auditEvents).values({
      tenantId,
      type: 'service.expiry_recovered',
      entityId: id,
      detail: {
        reason: decision.reason,
        previousState: row.state,
        state: 'expired-unexecuted',
        preparedDigest: prepared.digest,
        window,
        evidence,
        rules: EXPIRY_RULES,
        signaturesMayHaveExisted: true,
        paymentFailureAsserted: false,
        releasedAtomic: terms.amount,
        publicReservationReleased: tenantId !== OWNER_ID,
        walletEvents: events
          .filter((e) => e.type.startsWith('service.wallet_'))
          .map((e) => ({
            type: e.type,
            at: e.createdAt.toISOString(),
            code: (e.detail as { diagnostic?: { code?: string } })?.diagnostic?.code || null,
          })),
      },
    });
    return {
      state: 'expired-unexecuted',
      recovered: true,
      alreadyRecovered: false,
      preparedDigest: prepared.digest,
      releasedAtomic: terms.amount,
    };
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
  if (row.state === 'expired-unexecuted')
    return {
      state: row.state,
      message:
        'This historical transaction was closed after audited expiry reconciliation. Its bytes cannot be submitted again.',
    };
  const challenge = row.challenge as ServiceChallenge;
  const terms = serviceTermsSchema.parse(challenge.accepts[0]);

  if (
    raw === undefined &&
    ['quoted', 'approved'].includes(row.state) &&
    row.expiresAt <= new Date()
  )
    return {
      state: row.state,
      expired: true,
      message:
        'This quote has expired. Inspect the saved signing/submission status; only an unsigned, unsubmitted quote can be cancelled for fresh terms.',
    };

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
    requireNewSpend(tenantId);
    await requireNoOtherServiceAttempt(tenantId, id);
    configuredTerms(terms, row.payer!, await checkoutPayer(tenantId));
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
    const prepared = storedPreparation(row.approval);
    if (!prepared)
      throw new AppError(
        409,
        'PREPARATION_REQUIRED',
        'This legacy quote has no saved prepared bytes. No payment submitted. Review a fresh quote.',
      );
    if (prepared.bytes !== payload.payload.transaction)
      throw new AppError(
        400,
        'PREPARED_CHANGED',
        'Signed transaction differs from the exact saved prepared bytes. Nothing submitted.',
      );
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
      await verifyServiceSignature(
        payload.payload.transaction,
        payload.payload.signature,
        row.payer!,
        terms.network,
      );
    } catch (error) {
      const diagnostic = serviceDiagnostic('signature-verification', error, serverSecrets());
      await audit(tenantId, 'service.signature_unverified', id, {
        digest,
        settlementRequested: false,
        signatureCheckMayDiscloseBytes: true,
        diagnostic,
      });
      return {
        state: 'pending',
        digest,
        diagnostic,
        message:
          'Payer signature could not be verified. The attempt remains locked because zkLogin verification may disclose signed bytes. Reconcile this digest; do not sign or settle again.',
      };
    }
    try {
      const verify = await facilitator('/verify', {
        x402Version: 2,
        paymentPayload: payload,
        paymentRequirements: terms,
      });
      if (verify.isValid !== true || (verify.payer && verify.payer !== row.payer)) {
        const diagnostic = serviceDiagnostic('tentacle.verify', verify, serverSecrets());
        await audit(tenantId, 'service.verification_rejected', id, {
          digest,
          settlementRequested: false,
          diagnostic,
        });
        return {
          state: 'pending',
          digest,
          diagnostic,
          message: `Tentacle verification rejected: ${diagnostic.message} Signed bytes were disclosed; resume only this digest. No settlement assumed.`,
        };
      }
    } catch (error) {
      const diagnostic = serviceDiagnostic('tentacle.verify', error, serverSecrets());
      await audit(tenantId, 'service.verification_indeterminate', id, {
        digest,
        settlementRequested: false,
        diagnostic,
      });
      return {
        state: 'pending',
        digest,
        diagnostic,
        message: `Tentacle verification interrupted: ${diagnostic.message} Resume the existing digest; do not sign or pay again.`,
      };
    }
    try {
      await audit(tenantId, 'service.settlement_requested', id, {
        digest: row.digest,
        authoritative: false,
      });
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
        ...(settled.success !== true
          ? { diagnostic: serviceDiagnostic('tentacle.settle', settled, serverSecrets()) }
          : {}),
      });
    } catch (error) {
      await audit(tenantId, 'service.settlement_indeterminate', id, {
        digest: row.digest,
        provider: FACILITATOR,
        retrySettlement: false,
        diagnostic: serviceDiagnostic('tentacle.settle', error, serverSecrets()),
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
    await audit(tenantId, 'service.confirmation_requested', id, {
      digest: row.digest,
      source: 'Tatum native Mainnet gRPC',
    });
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
    const diagnostic = serviceDiagnostic('tatum.reconciliation', error, serverSecrets());
    await audit(tenantId, 'service.confirmation_pending', id, { digest: row.digest, diagnostic });
    return {
      state: 'pending',
      digest: row.digest,
      diagnostic,
      message: `Tatum ${diagnostic.code}: ${diagnostic.message} No finalized merchant credit confirmed. Resume this intent; do not pay again.`,
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
export async function rememberService(tenantId: string, id: string, consent = false) {
  if (consent !== true)
    throw new AppError(
      400,
      'MEMORY_CONSENT',
      'Explicit consent to the minimized vendor rule is required.',
    );
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
  const invoice = await ownedInvoice(tenantId, row.invoiceId);
  const context = await trustContext(tenantId, invoice);
  if (context.instructionHash !== row.instructionHash)
    throw new AppError(
      409,
      'INSTRUCTION_CHANGED',
      'Review the changed invoice instructions before consenting to a memory.',
    );
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

export async function serviceProgress(tenantId: string, id: string, sessionKey?: string) {
  const row = await ownedService(tenantId, id);
  const events = await (
    await db()
  )
    .select({
      type: s.auditEvents.type,
      detail: s.auditEvents.detail,
      createdAt: s.auditEvents.createdAt,
    })
    .from(s.auditEvents)
    .where(and(eq(s.auditEvents.tenantId, tenantId), eq(s.auditEvents.entityId, id)))
    .orderBy(desc(s.auditEvents.createdAt))
    .limit(40);
  const diagnostics = events
    .map((e) => (e.detail as { diagnostic?: ReturnType<typeof serviceDiagnostic> }).diagnostic)
    .filter((d): d is ReturnType<typeof serviceDiagnostic> => !!d);
  const diagnostic =
    diagnostics.find(
      (d) => d.stage.startsWith('tentacle') || d.stage === 'signature-verification',
    ) ||
    diagnostics[0] ||
    null;
  const prepared = storedPreparation(row.approval);
  const terms = serviceTermsSchema.parse((row.challenge as ServiceChallenge).accepts[0]);
  const walletEvent =
    events.find((e) => e.type === 'service.wallet_signed') ||
    events.find((e) => e.type.startsWith('service.wallet_'));
  const signingState = serviceSigningState({
    state: row.state,
    expired: row.expiresAt <= new Date(),
    disclosed: !!row.payloadHash || !!row.digest,
    submitted: events.some((e) => e.type === 'service.settlement_requested'),
    walletPhase: walletEvent?.type,
    walletCode: (walletEvent?.detail as { diagnostic?: { code?: string } })?.diagnostic?.code,
  });
  const recoveryBlocked = (await serviceRecoveryHolds(tenantId)).some((i) => i.id !== id);
  return {
    quoteId: id,
    state: row.state,
    expiresAt: row.expiresAt,
    expired: row.expiresAt <= new Date(),
    signingState,
    recoveryBlocked,
    // Reconciliation can permit another explicit approval of these SAME bytes after
    // a reported decline. Unknown errors and legacy interrupted attempts stay locked.
    retryAllowed:
      signingState === 'signature-declined' &&
      !recoveryBlocked &&
      row.state === 'approved' &&
      row.expiresAt > new Date() &&
      !!prepared &&
      !!sessionKey &&
      row.spendingSessionId === budgetId(tenantId, sessionKey, terms.network),
    canCancel:
      ['quoted', 'approved'].includes(row.state) &&
      !(prepared && terms.network === 'sui:mainnet') &&
      !row.payloadHash &&
      !row.digest &&
      !events.some((e) => e.type.startsWith('service.wallet_')),
    prepared: prepared || null,
    executionDigest: row.digest,
    approvalSessionMatches:
      !!sessionKey && row.spendingSessionId === budgetId(tenantId, sessionKey, terms.network),
    walletAttempted: events.some((e) => e.type.startsWith('service.wallet_')),
    submitted: events.some((e) => e.type === 'service.settlement_requested'),
    confirming: events.some((e) => e.type === 'service.confirmation_requested'),
    diagnostic,
  };
}
export async function recordServiceWalletEvent(
  tenantId: string,
  id: string,
  event: {
    phase: 'requested' | 'error' | 'signed';
    preparedDigest: string;
    code?: string;
    message?: string;
  },
  sessionKey?: string,
) {
  const row = await ownedService(tenantId, id),
    prepared = storedPreparation(row.approval);
  const terms = serviceTermsSchema.parse((row.challenge as ServiceChallenge).accepts[0]);
  if (
    !prepared ||
    prepared.digest !== event.preparedDigest ||
    !sessionKey ||
    row.spendingSessionId !== budgetId(tenantId, sessionKey, terms.network)
  )
    throw new AppError(
      409,
      'PREPARED_STATE',
      'Wallet diagnostic does not match this session and saved prepared transaction.',
    );
  await audit(tenantId, 'service.wallet_' + event.phase, id, {
    preparedDigest: prepared.digest,
    authoritative: false,
    ...(event.phase === 'error'
      ? {
          diagnostic: serviceDiagnostic(
            'wallet-signing',
            { code: event.code, message: event.message },
            serverSecrets(),
          ),
        }
      : {}),
  });
  return { recorded: true };
}
export async function listServiceIntents(tenantId: string) {
  const rows = await (
    await db()
  )
    .select({
      id: s.servicePaymentIntents.id,
      invoiceId: s.servicePaymentIntents.invoiceId,
      challenge: s.servicePaymentIntents.challenge,
      state: s.servicePaymentIntents.state,
      payer: s.servicePaymentIntents.payer,
      digest: s.servicePaymentIntents.digest,
      expiresAt: s.servicePaymentIntents.expiresAt,
      approval: s.servicePaymentIntents.approval,
    })
    .from(s.servicePaymentIntents)
    .where(eq(s.servicePaymentIntents.tenantId, tenantId))
    .orderBy(desc(s.servicePaymentIntents.createdAt), desc(s.servicePaymentIntents.id))
    .limit(30);
  return rows.map(({ approval, ...row }) => ({
    ...row,
    prepared: storedPreparation(approval) || null,
  }));
}
