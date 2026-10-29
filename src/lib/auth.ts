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
function ownerVersion() {
  const password = process.env.OWNER_PASSWORD;
  if (!password || password.length < 16) return null;
  return createHmac('sha256', secret())
    .update('payguard:owner-version:' + password)
    .digest('hex');
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
export async function currentActor() {
  if (!databaseConfigured()) return null;
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const [r] = await (
    await db()
  )
    .select({
      sessionKey: sessions.id,
      tenantId: sessions.tenantId,
      role: users.role,
      walletAddress: users.walletAddress,
      authVersion: sessions.authVersion,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.tenantId))
    .where(
      and(
        eq(sessions.id, hash(createHmac('sha256', secret()).update(token).digest('hex'))),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!r || (r.role === 'owner' && (!r.authVersion || r.authVersion !== ownerVersion())))
    return null;
  return {
    tenantId: r.tenantId,
    role: r.role,
    walletAddress: r.walletAddress,
    sessionKey: r.sessionKey,
  };
}
export async function currentUser() {
  return (await currentActor())?.tenantId ?? null;
}
export async function requireWorkspace() {
  const actor = await currentActor();
  if (!actor)
    throw new AppError(
      401,
      'AUTH_REQUIRED',
      'Sign in to access private records and live integrations.',
    );
  return actor;
}
export async function requireOwner() {
  const actor = await requireWorkspace();
  if (actor.role !== 'owner')
    throw new AppError(403, 'OWNER_REQUIRED', 'This operation requires administrator access.');
  return actor.tenantId;
}
export async function createSession(tenantId: string) {
  await logout(); // Rotate an existing session when signing in or switching identity.
  const token = randomBytes(32).toString('hex');
  await (await db()).insert(sessions).values({
    id: hash(createHmac('sha256', secret()).update(token).digest('hex')),
    tenantId,
    authVersion: tenantId === OWNER_ID ? ownerVersion() : null,
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
    .values({ id: OWNER_ID, name: 'Workspace owner', role: 'owner', settings: DEFAULT_PREFERENCES })
    .onConflictDoNothing();
  await createSession(OWNER_ID);
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
