import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { and, eq, gt, sql } from 'drizzle-orm';
import { db, databaseConfigured } from '@/db';
import { sessions, rateLimits, users } from '@/db/schema';
import { AppError, unavailable } from './errors';
import { OWNER_ID } from './demo';
import { DEFAULT_PREFERENCES } from './types';
const cookieName = 'payguard_session';
function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) unavailable('Session secret');
  return s;
}
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export async function rateLimit(key: string, limit: number, seconds = 3600) {
  const d = await db();
  const bucket = Math.floor(Date.now() / (seconds * 1000));
  const [r] = await d
    .insert(rateLimits)
    .values({
      key: `${key}:${bucket}`,
      count: 1,
      expiresAt: new Date((bucket + 1) * seconds * 1000),
    })
    .onConflictDoUpdate({ target: rateLimits.key, set: { count: sql`${rateLimits.count}+1` } })
    .returning();
  if (r.count > limit)
    throw new AppError(
      429,
      'RATE_LIMIT',
      'Request limit reached. Please wait for the next quota window.',
    );
}
export function checkOrigin(request: Request) {
  const expected = process.env.APP_URL;
  if (!expected) unavailable('APP_URL');
  const origin = request.headers.get('origin');
  if (
    !origin ||
    origin !== new URL(expected).origin ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    throw new AppError(403, 'ORIGIN', 'Request origin is not allowed.');
}
export async function currentUser() {
  if (!databaseConfigured()) return null;
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const [r] = await (
    await db()
  )
    .select({ tenantId: sessions.tenantId })
    .from(sessions)
    .where(
      and(
        eq(sessions.id, hash(createHmac('sha256', secret()).update(token).digest('hex'))),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return r?.tenantId ?? null;
}
export async function requireOwner() {
  const id = await currentUser();
  if (!id)
    throw new AppError(
      401,
      'AUTH_REQUIRED',
      'Owner login is required for private records and live integrations.',
    );
  return id;
}
export async function login(password: string) {
  if (!databaseConfigured()) unavailable('Neon database');
  // Global account throttle also works behind untrusted forwarding proxies.
  await rateLimit('owner-login', 10, 900);
  const expected = process.env.OWNER_PASSWORD;
  if (!expected || expected.length < 16) unavailable('Owner password');
  const a = createHmac('sha256', secret()).update(password).digest();
  const b = createHmac('sha256', secret()).update(expected).digest();
  if (!timingSafeEqual(a, b)) throw new AppError(401, 'INVALID_LOGIN', 'Incorrect owner password.');
  const d = await db();
  await d
    .insert(users)
    .values({ id: OWNER_ID, name: 'Workspace owner', settings: DEFAULT_PREFERENCES })
    .onConflictDoNothing();
  const token = randomBytes(32).toString('hex');
  await d.insert(sessions).values({
    id: hash(createHmac('sha256', secret()).update(token).digest('hex')),
    tenantId: OWNER_ID,
    expiresAt: new Date(Date.now() + 8 * 3600000),
  });
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    secure: new URL(process.env.APP_URL!).protocol === 'https:',
    sameSite: 'strict',
    path: '/',
    maxAge: 8 * 3600,
  });
}
export async function logout() {
  const token = (await cookies()).get(cookieName)?.value;
  if (token && databaseConfigured())
    await (
      await db()
    )
      .delete(sessions)
      .where(eq(sessions.id, hash(createHmac('sha256', secret()).update(token).digest('hex'))));
  (await cookies()).delete(cookieName);
}
