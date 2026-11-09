import 'server-only';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { db, withDatabaseRequest } from '@/db';
import * as s from '@/db/schema';
import { reconcileServicePayment } from './service-payments';

// The durable queue is the persisted settling state and original digest.
// Never calls fulfillService, a wallet, a facilitator or reservation recovery.
export async function reconcilePendingServicePayments() {
  const rows = await (
    await db()
  )
    .select({ id: s.servicePaymentIntents.id, tenantId: s.servicePaymentIntents.tenantId })
    .from(s.servicePaymentIntents)
    .where(
      and(eq(s.servicePaymentIntents.state, 'settling'), isNotNull(s.servicePaymentIntents.digest)),
    )
    .orderBy(
      sql`coalesce((select max(created_at) from audit_events where entity_id = ${s.servicePaymentIntents.id}::text and type = 'service.confirmation_requested'), to_timestamp(0))`,
    )
    .limit(3);
  let settled = 0,
    pending = 0,
    held = 0;
  const deadline = Date.now() + 25000;
  for (const row of rows) {
    if (Date.now() > deadline) break;
    try {
      const result = await reconcileServicePayment(row.tenantId, row.id);
      if (result.state === 'settled') settled++;
      else pending++;
    } catch {
      held++;
    }
  }
  return { settled, pending, held, maximumPerRun: 3, submissions: 0 };
}

export async function continueServiceConfirmation(tenantId: string, id: string) {
  await new Promise((resolve) => setTimeout(resolve, 4000));
  // after() can inherit the completed request's AsyncLocalStorage; always use a fresh pool.
  return withDatabaseRequest(async () => {
    try {
      return await reconcileServicePayment(tenantId, id);
    } catch {
      return { state: 'pending' };
    }
  }, true);
}
