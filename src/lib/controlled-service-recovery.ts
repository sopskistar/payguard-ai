import 'server-only';
import { and, eq, inArray, or } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { Transaction } from '@mysten/sui/transactions';
import { db } from '@/db';
import * as s from '@/db/schema';
import { OWNER_ID } from './demo';
import { AppError } from './errors';
import {
  serviceTermsSchema,
  validateServiceTransaction,
  type ServiceChallenge,
} from './service-protocol';
import { assessServiceExpiry, EXPIRY_RULES, type ServiceExpiryEvidence } from './service-expiry';
import {
  APPROVED_SERVICE_RECOVERIES,
  type ControlledRecoveryStatus,
} from './approved-service-recoveries';

// Read-only, session-scoped verification. It never invokes recovery, signs,
// queries providers, changes a flag, or returns another workspace's records.
export async function controlledServiceRecoveryStatus(
  tenantId: string,
): Promise<ControlledRecoveryStatus> {
  return (await db()).transaction(
    async (tx) => {
      const [actor] = await tx.select().from(s.users).where(eq(s.users.id, tenantId));
      if (
        !actor ||
        !['owner', 'member'].includes(actor.role) ||
        (actor.role === 'owner' && tenantId !== OWNER_ID)
      )
        throw new AppError(
          403,
          'WORKSPACE_REQUIRED',
          'An authorized original workspace is required.',
        );
      const selected = APPROVED_SERVICE_RECOVERIES.filter(
        (r) => r.role === actor.role && (r.role === 'owner' || r.payer === actor.walletAddress),
      );
      const result: ControlledRecoveryStatus = {
        enabled: process.env.SERVICE_EXPIRED_RECOVERY_ENABLED === 'true',
        checkedAt: new Date().toISOString(),
        scope: null,
        verified: true,
        allOriginalsClosed: false,
        issues: [],
        nextId: null,
        records: [],
        wallet: null,
        sponsor: null,
      };
      if (!selected.length) return result;
      const rows = await tx
        .select()
        .from(s.servicePaymentIntents)
        .where(
          and(
            eq(s.servicePaymentIntents.tenantId, tenantId),
            inArray(
              s.servicePaymentIntents.id,
              selected.map((r) => r.id),
            ),
          ),
        );
      if (!rows.length) return result;
      result.scope = actor.role + ':' + selected[0].payer;
      const events = await tx
        .select()
        .from(s.auditEvents)
        .where(
          and(
            eq(s.auditEvents.tenantId, tenantId),
            inArray(
              s.auditEvents.entityId,
              rows.map((r) => r.id),
            ),
          ),
        );
      const receipts = await tx
        .select({
          intentId: s.servicePaymentReceipts.intentId,
          digest: s.servicePaymentReceipts.digest,
        })
        .from(s.servicePaymentReceipts)
        .where(
          or(
            inArray(
              s.servicePaymentReceipts.intentId,
              rows.map((r) => r.id),
            ),
            inArray(
              s.servicePaymentReceipts.digest,
              selected.map((r) => r.digest),
            ),
          ),
        );
      for (const spec of selected) {
        const row = rows.find((r) => r.id === spec.id);
        if (!row) {
          result.issues.push('ORIGINAL_RECORD_MISSING');
          continue;
        }
        const issues: string[] = [];
        const preparation = (
          row.approval as { prepared?: { bytes: string; digest: string } } | null
        )?.prepared;
        try {
          if (
            !preparation ||
            row.payer !== spec.payer ||
            !row.approvedAt ||
            !row.spendingSessionId ||
            row.digest ||
            row.payloadHash ||
            receipts.some((r) => r.intentId === row.id || r.digest === spec.digest)
          )
            throw Error('binding');
          const terms = serviceTermsSchema.parse((row.challenge as ServiceChallenge).accepts[0]);
          validateServiceTransaction(preparation.bytes, terms, row.payer);
          const transaction = Transaction.from(preparation.bytes),
            validity = transaction.getData().expiration;
          if (
            preparation.digest !== spec.digest ||
            (await transaction.getDigest()) !== spec.digest ||
            terms.amount !== spec.amountAtomic ||
            terms.network !== 'sui:mainnet' ||
            terms.extra.quoteId !== spec.id ||
            validity?.$kind !== 'ValidDuring' ||
            String(validity.ValidDuring.minEpoch) !== spec.minEpoch ||
            String(validity.ValidDuring.maxEpoch) !== spec.maxEpoch ||
            (actor.role === 'member' &&
              (actor.walletAddress !== row.payer || terms.extra.authenticatedPayer !== row.payer))
          )
            throw Error('binding');
        } catch {
          issues.push('ORIGINAL_PREPARATION_CONFLICT');
        }
        const history = events.filter((e) => e.entityId === row.id);
        if (
          history.some(
            (e) =>
              e.type.startsWith('service.settlement_') ||
              e.type.startsWith('service.confirmation_'),
          )
        )
          issues.push('SETTLEMENT_REQUIRES_RECONCILIATION');
        if (history.some((e) => e.type === 'service.expiry_recovery_held'))
          issues.push('RECOVERY_HELD_REVIEW_REQUIRED');
        const recovered = history.filter((e) => e.type === 'service.expiry_recovered');
        let recoveredVerified = false;
        if (row.state === 'expired-unexecuted') {
          try {
            if (recovered.length !== 1) throw Error('audit count');
            const detail = recovered[0].detail as {
              reason?: string;
              previousState?: string;
              state?: string;
              preparedDigest?: string;
              releasedAtomic?: string;
              publicReservationReleased?: boolean;
              signaturesMayHaveExisted?: boolean;
              paymentFailureAsserted?: boolean;
              window?: { digest: string; minEpoch: string; maxEpoch: string };
              rules?: { protocolVersion?: string };
              evidence?: ServiceExpiryEvidence[];
            };
            const proof = detail.evidence;
            if (
              detail.reason !== 'EXPIRED_UNEXECUTED' ||
              detail.previousState !== 'approved' ||
              detail.state !== row.state ||
              detail.preparedDigest !== spec.digest ||
              detail.releasedAtomic !== spec.amountAtomic ||
              detail.publicReservationReleased !== (actor.role === 'member') ||
              detail.signaturesMayHaveExisted !== true ||
              detail.paymentFailureAsserted !== false ||
              detail.rules?.protocolVersion !== EXPIRY_RULES.protocolVersion ||
              detail.window?.digest !== spec.digest ||
              detail.window?.minEpoch !== spec.minEpoch ||
              detail.window?.maxEpoch !== spec.maxEpoch ||
              !Array.isArray(proof)
            )
              throw Error('audit fields');
            // Corroborate retained successful evidence at its observation completion.
            // New releases always collect fresh evidence in the existing procedure.
            const completion = Math.max(
              ...proof
                .flatMap((e) => [e.checkedAt, ...(e.reads || []).map((r) => r.checkedAt)])
                .map(Date.parse),
            );
            if (
              !Number.isFinite(completion) ||
              !assessServiceExpiry(detail.window, proof, completion + 1).eligible
            )
              throw Error('proof');
            recoveredVerified = !issues.length;
          } catch {
            issues.push('RECOVERY_AUDIT_CONFLICT');
          }
        } else if (row.state !== 'approved' || recovered.length)
          issues.push('RECOVERY_STATE_CONFLICT');
        result.records.push({
          id: row.id,
          payer: row.payer || '',
          digest: spec.digest,
          amountAtomic: spec.amountAtomic,
          state: row.state,
          recoveredVerified,
          auditId: recoveredVerified ? recovered[0].id : null,
          releasedAtomic: recoveredVerified ? spec.amountAtomic : '0',
          issues,
        });
      }
      // Same complete-liability rule as guarded recovery. Only aggregate sponsor
      // totals are exposed; other users' intents, prepared bytes and audits are not.
      const ledger = await tx
        .select({
          id: s.servicePaymentIntents.id,
          tenantId: s.servicePaymentIntents.tenantId,
          state: s.servicePaymentIntents.state,
          spendingSessionId: s.servicePaymentIntents.spendingSessionId,
          approvedAt: s.servicePaymentIntents.approvedAt,
          challenge: s.servicePaymentIntents.challenge,
          payer: s.servicePaymentIntents.payer,
        })
        .from(s.servicePaymentIntents);
      result.allOriginalsClosed = APPROVED_SERVICE_RECOVERIES.every((spec) =>
        ledger.some(
          (item) =>
            item.id === spec.id && item.payer === spec.payer && item.state === 'expired-unexecuted',
        ),
      );
      const publicId = createHash('sha256')
        .update('payguard:public-sponsored-pilot:v1:sui:mainnet')
        .digest('hex');
      const ownBudgetIds = [
        ...new Set(rows.map((r) => r.spendingSessionId).filter((v): v is string => !!v)),
      ];
      const budgets = await tx
        .select()
        .from(s.serviceSpendingSessions)
        .where(inArray(s.serviceSpendingSessions.id, [publicId, ...ownBudgetIds]));
      if (ownBudgetIds.length !== 1) result.issues.push('ORIGINAL_BUDGET_CONFLICT');
      for (const budgetId of [publicId, ...ownBudgetIds]) {
        const budget = budgets.find((b) => b.id === budgetId),
          isPublic = budgetId === publicId;
        if (!budget) {
          result.issues.push('RESERVATION_MISSING');
          continue;
        }
        try {
          let liability = 0n;
          for (const item of ledger) {
            if (
              !item.spendingSessionId ||
              ['cancelled', 'expired-unexecuted'].includes(item.state) ||
              (isPublic ? item.tenantId === OWNER_ID : item.spendingSessionId !== budget.id)
            )
              continue;
            const terms = serviceTermsSchema.parse((item.challenge as ServiceChallenge).accepts[0]);
            if (terms.network !== 'sui:mainnet') continue;
            if (
              !item.approvedAt ||
              !['approved', 'settling', 'settled', 'failed'].includes(item.state)
            )
              throw Error('liability');
            liability += BigInt(terms.amount);
          }
          const expectedSpecs = isPublic
            ? APPROVED_SERVICE_RECOVERIES.filter((r) => r.role === 'member')
            : selected;
          let expected = 0n;
          for (const spec of expectedSpecs) {
            const item = ledger.find((i) => i.id === spec.id);
            if (
              !item ||
              item.payer !== spec.payer ||
              !['approved', 'expired-unexecuted'].includes(item.state)
            )
              throw Error('scope');
            if (item.state === 'approved') expected += BigInt(spec.amountAtomic);
          }
          // Once the window is closed, legitimate later purchases may reserve the
          // same budget. They remain fully counted, while the historical releases
          // retain their own immutable audit proof. During the controlled window,
          // unexpected additional liabilities stop the sequence.
          let otherLiability = 0n;
          for (const item of ledger) {
            if (
              expectedSpecs.some((spec) => spec.id === item.id) ||
              !item.spendingSessionId ||
              ['cancelled', 'expired-unexecuted'].includes(item.state) ||
              (isPublic ? item.tenantId === OWNER_ID : item.spendingSessionId !== budget.id)
            )
              continue;
            const terms = serviceTermsSchema.parse((item.challenge as ServiceChallenge).accepts[0]);
            if (terms.network === 'sui:mainnet') otherLiability += BigInt(terms.amount);
          }
          if (result.enabled && otherLiability !== 0n) throw Error('unexpected liability');
          expected += otherLiability;
          if (
            budget.tenantId !== (isPublic ? OWNER_ID : tenantId) ||
            budget.payer !== (isPublic ? 'public-sponsored-pilot-ledger' : selected[0].payer) ||
            budget.network !== 'sui:mainnet' ||
            budget.asset !== '0x2::sui::SUI' ||
            BigInt(budget.reservedAtomic) !== liability ||
            liability !== expected ||
            liability > BigInt(budget.capAtomic)
          )
            throw Error('totals');
          const total = {
            reservedAtomic: budget.reservedAtomic,
            liabilityAtomic: liability.toString(),
          };
          if (isPublic) result.sponsor = total;
          else result.wallet = total;
        } catch {
          result.issues.push(isPublic ? 'SPONSOR_LIABILITY_CONFLICT' : 'WALLET_LIABILITY_CONFLICT');
        }
      }
      result.verified = !result.issues.length && result.records.every((r) => !r.issues.length);
      if (result.verified)
        result.nextId = result.records.find((r) => r.state === 'approved')?.id || null;
      return result;
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );
}
