import 'server-only';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import { z } from 'zod';
import { db } from '@/db';
import { walletChallenges, users, auditEvents } from '@/db/schema';
import { createSession, rateLimit } from './auth';
import { AppError, unavailable } from './errors';
import { DEFAULT_PREFERENCES } from './types';
import { walletOnboardingAllowed, WALLET_REVIEW_MESSAGE } from './wallet-policy';

function requireWalletOnboarding() {
  if (!walletOnboardingAllowed())
    throw new AppError(503, 'WALLET_SECURITY_REVIEW', WALLET_REVIEW_MESSAGE);
}

const bindingCookie = 'payguard_wallet_challenge';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const walletAddressInput = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/)
  .transform((value) => normalizeSuiAddress(value));
export const walletProofInput = z
  .object({
    id: z.string().uuid(),
    address: walletAddressInput,
    signature: z
      .string()
      .min(40)
      .max(12000)
      .regex(/^[A-Za-z0-9+/=]+$/),
  })
  .strict();
function origin() {
  if (!process.env.APP_URL) unavailable('APP_URL');
  return new URL(process.env.APP_URL!).origin;
}
function invalid(): never {
  throw new AppError(
    401,
    'WALLET_CHALLENGE',
    'Wallet sign-in failed. The challenge may be expired, used, or signed by another account. Request a new message.',
  );
}
export async function issueWalletChallenge(address: string) {
  requireWalletOnboarding();
  const normalized = walletAddressInput.parse(address);
  await rateLimit('wallet:challenges:global', 300, 900);
  await rateLimit(`wallet:challenge:${normalized}`, 12, 900);
  const d = await db();
  // Periodic bounded data retention, including consumed challenges; never touch user records.
  await d
    .delete(walletChallenges)
    .where(lt(walletChallenges.expiresAt, new Date(Date.now() - 86400000)));
  const id = randomUUID();
  const nonce = randomBytes(32).toString('hex');
  const binding = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 5 * 60000);
  const appOrigin = origin();
  const message = [
    'PayGuard Verify — Sign in to your private workspace',
    `Application: ${appOrigin}`,
    `Wallet: ${normalized}`,
    'Purpose: Authenticate this wallet to a PayGuard user account.',
    'This personal message does not authorize any transaction, payment, transfer, or token approval.',
    `Challenge: ${id}`,
    `Nonce: ${nonce}`,
    `Issued: ${new Date().toISOString()}`,
    `Expires: ${expiresAt.toISOString()}`,
  ].join('\n');
  await d.insert(walletChallenges).values({
    id,
    address: normalized,
    message,
    origin: appOrigin,
    bindingHash: hash(binding),
    expiresAt,
  });
  (await cookies()).set(bindingCookie, binding, {
    httpOnly: true,
    secure: appOrigin.startsWith('https:'),
    sameSite: 'strict',
    path: '/',
    maxAge: 300,
  });
  return { id, address: normalized, message, expiresAt: expiresAt.toISOString() };
}
export async function verifyWalletLogin(input: z.infer<typeof walletProofInput>) {
  requireWalletOnboarding();
  await rateLimit('wallet:verify:global', 500, 900);
  await rateLimit(`wallet:verify:${input.address}`, 20, 900);
  const binding = (await cookies()).get(bindingCookie)?.value;
  if (!binding) invalid();
  const d = await db();
  const [challenge] = await d
    .select()
    .from(walletChallenges)
    .where(
      and(
        eq(walletChallenges.id, input.id),
        eq(walletChallenges.address, input.address),
        eq(walletChallenges.bindingHash, hash(binding)),
        eq(walletChallenges.origin, origin()),
        isNull(walletChallenges.consumedAt),
        gt(walletChallenges.expiresAt, new Date()),
      ),
    );
  if (!challenge) invalid();
  try {
    const key = await verifyPersonalMessageSignature(
      new TextEncoder().encode(challenge.message),
      input.signature,
      { address: challenge.address },
    );
    if (key.toSuiAddress() !== challenge.address) invalid();
  } catch {
    invalid();
  }
  const user = await d.transaction(async (tx) => {
    // Database compare-and-set: concurrent verification can only consume once.
    const consumed = await tx
      .update(walletChallenges)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(walletChallenges.id, challenge.id),
          isNull(walletChallenges.consumedAt),
          gt(walletChallenges.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!consumed.length) invalid();
    const [identity] = await tx
      .insert(users)
      .values({
        name: `Wallet ${challenge.address.slice(0, 8)}`,
        walletAddress: challenge.address,
        role: 'member',
        settings: DEFAULT_PREFERENCES,
      })
      .onConflictDoUpdate({
        target: users.walletAddress,
        set: { walletAddress: challenge.address },
      })
      .returning();
    if (identity.role !== 'member')
      throw new AppError(403, 'ROLE', 'Wallet login cannot open an administrator account.');
    await tx.insert(auditEvents).values({
      tenantId: identity.id,
      type: 'auth.wallet_verified',
      detail: { personalMessage: true, challengeId: challenge.id },
    });
    return identity;
  });
  await createSession(user.id);
  (await cookies()).delete(bindingCookie);
  return { ok: true, walletAddress: user.walletAddress, role: 'member' };
}
