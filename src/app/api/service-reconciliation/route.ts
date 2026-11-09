import { withDatabaseRequest } from '@/db';
import { requireCronAuthorization } from '@/lib/cron-auth';
import { reconcilePendingServicePayments } from '@/lib/service-reconciliation';
import { privateJson, businessFailure } from '@/lib/business-http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const GET = (request: Request) =>
  withDatabaseRequest(async () => {
    try {
      requireCronAuthorization(request);
      return privateJson(await reconcilePendingServicePayments());
    } catch (error) {
      return businessFailure(error);
    }
  });
