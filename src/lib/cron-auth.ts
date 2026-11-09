import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { AppError } from './errors';
export function requireCronAuthorization(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32)
    throw new AppError(
      503,
      'CRON_NOT_CONFIGURED',
      'Scheduled processing requires owner configuration.',
    );
  const expected = createHash('sha256')
    .update('Bearer ' + secret)
    .digest();
  const actual = createHash('sha256')
    .update(request.headers.get('authorization') || '')
    .digest();
  if (!timingSafeEqual(actual, expected))
    throw new AppError(401, 'AUTH_REQUIRED', 'Scheduler authorization required.');
}
