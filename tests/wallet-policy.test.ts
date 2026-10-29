import { expect, it } from 'vitest';
import { walletOnboardingAllowed } from '@/lib/wallet-policy';
it('pauses hosted onboarding regardless of development/test flags or loopback configuration', () => {
  for (const env of [
    { VERCEL: '1', APP_URL: 'http://localhost:3000', NODE_ENV: 'test' },
    { APP_URL: 'https://payguard-ai-henna.vercel.app', NODE_ENV: 'test' },
    { APP_URL: 'https://other-public.example', NODE_ENV: 'production' },
    {},
  ])
    expect(walletOnboardingAllowed(env as NodeJS.ProcessEnv)).toBe(false);
});
it('permits controlled loopback and isolated test fixtures without a public release override', () => {
  for (const hostname of ['localhost', '127.0.0.1', '[::1]'])
    expect(walletOnboardingAllowed({ APP_URL: `http://${hostname}:3002` })).toBe(true);
  expect(walletOnboardingAllowed({ NODE_ENV: 'test' })).toBe(true);
});
