// Personal-message authentication and financial signing have separate policies.
// A provider warning must never be overridden, including on localhost.
export const WALLET_REVIEW_MESSAGE =
  'Production transaction signing is paused by PayGuard’s hosted-origin policy. Wallet connection and free personal-message login are separate. A current physical-provider verdict is unverified. Do not override a wallet warning.';
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
) => !walletOnboardingAllowed(env);

export function walletProviderAllowed(name: string, slushBlocked: boolean) {
  return !slushBlocked || !/slush|sui wallet/i.test(name);
}

export function walletOperationPolicy(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  const connectionAvailable = walletOnboardingAllowed(env);
  const financialOriginAllowed = serviceWalletSigningAllowed(env);
  let origin: string | null = null;
  try {
    origin = new URL(env.APP_URL || '').origin;
  } catch {}
  const environment =
    env.VERCEL ||
    (origin && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname))
      ? 'production'
      : origin
        ? 'local'
        : 'unconfigured';
  return {
    origin,
    environment,
    connectionAvailable,
    authenticationAvailable: connectionAvailable,
    financialOriginAllowed,
    providerVerdict: 'unobserved',
    financialRestriction: financialOriginAllowed
      ? null
      : environment === 'production'
        ? 'Production transaction preparation/signing is restricted by PayGuard application policy. A current physical provider verdict has not been verified; this is separate from free wallet login.'
        : 'The server has no permitted transaction-signing origin. Check APP_URL.',
  };
}
