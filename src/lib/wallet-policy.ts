// Remove the hosted pause only after the Slush review and a controlled wallet retest.
// No environment flag can override it on Vercel or the reported production origin.
export const WALLET_REVIEW_MESSAGE =
  'Wallet onboarding is paused: Slush has reported a malicious-website warning for this production domain. The cause is unresolved. Do not override wallet warnings or connect a funded wallet. The public demo and owner sign-in remain available.';
export function walletOnboardingAllowed(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  if (env.VERCEL || env.APP_URL?.includes('payguard-ai-henna.vercel.app')) return false;
  if (env.NODE_ENV === 'test') return true; // Isolated, unfunded signature fixtures only.
  try {
    const origin = new URL(env.APP_URL || '');
    return ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  } catch {
    return false;
  }
}
