import { expect, it } from 'vitest';
import {
  walletOnboardingAllowed,
  serviceWalletSigningAllowed,
  walletProviderAllowed,
  slushOnboardingBlocked,
} from '@/lib/wallet-policy';
it('keeps hosted financial signing paused independently of authentication or development flags', () => {
  for (const env of [
    { VERCEL: '1', APP_URL: 'http://localhost:3000', NODE_ENV: 'test' },
    { APP_URL: 'https://payguard-ai-henna.vercel.app', NODE_ENV: 'test' },
    { APP_URL: 'https://other-public.example', NODE_ENV: 'production' },
    {},
  ])
    expect(serviceWalletSigningAllowed(env as NodeJS.ProcessEnv)).toBe(false);
});
it('permits controlled loopback and isolated test fixtures without a public release override', () => {
  for (const hostname of ['localhost', '127.0.0.1', '[::1]'])
    expect(serviceWalletSigningAllowed({ APP_URL: `http://${hostname}:3002` })).toBe(true);
  expect(walletOnboardingAllowed({ NODE_ENV: 'test' })).toBe(true);
});
it('allows production personal-message login independently of hosted financial signing', () => {
  const production = { VERCEL: '1', APP_URL: 'https://payguard-ai-henna.vercel.app' };
  expect(walletOnboardingAllowed(production)).toBe(true);
  expect(slushOnboardingBlocked(production)).toBe(false);
  expect(serviceWalletSigningAllowed(production)).toBe(false);
  expect(walletProviderAllowed('Slush', true)).toBe(false);
  expect(walletProviderAllowed('Sui Wallet', true)).toBe(false);
  expect(walletProviderAllowed('Other compatible wallet', true)).toBe(true);
  expect(walletProviderAllowed('Slush', false)).toBe(true);
  for (const url of ['http://public.example', 'file:///tmp', 'not-a-url', 'javascript:alert(1)'])
    expect(walletOnboardingAllowed({ APP_URL: url })).toBe(false);
  expect(walletOnboardingAllowed({ APP_URL: 'http://localhost:4320' })).toBe(true);
});
