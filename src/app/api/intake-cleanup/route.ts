import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest } from 'next/server';
import { withDatabaseRequest } from '@/db';
import { checkOrigin, requireOwner } from '@/lib/auth';
import { purgeExpiredDocuments } from '@/lib/documents';
import { privateJson, businessFailure } from '@/lib/business-http';
import { AppError } from '@/lib/errors';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const GET = (req: NextRequest) =>
  withDatabaseRequest(async () => {
    try {
      const secret = process.env.CRON_SECRET;
      if (!secret || secret.length < 32)
        throw new AppError(
          503,
          'CLEANUP_NOT_CONFIGURED',
          'Scheduled retention cleanup requires owner configuration.',
        );
      const expected = createHash('sha256')
          .update('Bearer ' + secret)
          .digest(),
        actual = createHash('sha256')
          .update(req.headers.get('authorization') || '')
          .digest();
      if (!timingSafeEqual(actual, expected))
        throw new AppError(401, 'AUTH_REQUIRED', 'Scheduler authorization required.');
      return privateJson(await purgeExpiredDocuments());
    } catch (error) {
      return businessFailure(error);
    }
  });
export const POST = (req: NextRequest) =>
  withDatabaseRequest(async () => {
    try {
      checkOrigin(req);
      await requireOwner();
      return privateJson(await purgeExpiredDocuments());
    } catch (error) {
      return businessFailure(error);
    }
  });
