import { expect, it } from 'vitest';
import { localOwnerConfig } from '../tools/local-owner/config';
const source = {
  DATABASE_URL: 'synthetic-private-db',
  TATUM_API_KEY: 'synthetic',
  AUTH_SECRET: 's'.repeat(32),
  OWNER_PASSWORD: 'p'.repeat(16),
  SERVICE_PAYMENT_SETTLEMENT_ENABLED: 'true',
  ENABLE_AGENT_PAYMENTS: 'false',
};
const parties = {
  SERVICE_PAYMENT_PAYER: '0x' + '1'.repeat(64),
  SERVICE_PAYMENT_RECIPIENT: '0x' + '2'.repeat(64),
};
it('starts the existing authenticated Mainnet product on loopback with settlement explicitly off', () => {
  const env = localOwnerConfig(source, parties);
  expect(env.APP_URL).toBe('http://localhost:4320');
  expect(env.SERVICE_PAYMENT_SETTLEMENT_ENABLED).toBe('false');
  expect(env.ENABLE_AGENT_PAYMENTS).toBe('mainnet');
  expect(env.DATABASE_URL).toBe(source.DATABASE_URL);
  expect(env.LOCAL_DATABASE_PATH).toBe('');
  expect(localOwnerConfig(source, parties, true).SERVICE_PAYMENT_SETTLEMENT_ENABLED).toBe('true');
});
it('rejects hosted use, missing authentication, changed parties and a self-payment recipient', () => {
  for (const extra of [
    { VERCEL: '1' },
    { CI: 'true' },
    { DATABASE_URL: '' },
    { OWNER_PASSWORD: 'short' },
    { SERVICE_PAYMENT_PAYER: parties.SERVICE_PAYMENT_RECIPIENT },
  ])
    expect(() => localOwnerConfig({ ...source, ...extra }, parties, true)).toThrow();
  expect(() =>
    localOwnerConfig(source, {
      ...parties,
      SERVICE_PAYMENT_RECIPIENT: parties.SERVICE_PAYMENT_PAYER,
    }),
  ).toThrow();
});
