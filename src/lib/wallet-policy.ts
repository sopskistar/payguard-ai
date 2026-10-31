// Personal-message authentication and financial signing have separate policies.
// A provider warning must never be overridden, including on localhost.
export const WALLET_REVIEW_MESSAGE =
  'Production payment signing is paused while the Slush domain warning is unresolved. Do not override a wallet warning. The public demo, owner workspace and permitted personal-message login remain available. The owner can inspect and run the same application locally; localhost does not clear the production domain.';
export function walletOnboardingAllowed(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  if (env.NODE_ENV === 'test' && !env.APP_URL) return true;
  try {
    const origin = new URL(env.APP_URL || '');
    return (
      origin.protocol === 'https:' ||
      (origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname))
    );
  } catch {
    return false;
  }
}
export function serviceWalletSigningAllowed(
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
export const slushOnboardingBlocked = (
  env: Readonly<Record<string, string | undefined>> = process.env,
) => !serviceWalletSigningAllowed(env);

export function walletProviderAllowed(name: string, slushBlocked: boolean) {
  return !slushBlocked || !/slush|sui wallet/i.test(name);
}
