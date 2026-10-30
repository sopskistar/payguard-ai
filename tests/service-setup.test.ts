import { expect, it } from 'vitest';
import { serviceConfiguration, fundingState, formatSui } from '@/lib/service-setup';
const payer = '0x' + '1'.repeat(64),
  recipient = '0x' + '2'.repeat(64);
it('distinguishes missing, invalid and reused addresses without exposing any credential', () => {
  expect(serviceConfiguration({}).partiesValid).toBe(false);
  expect(serviceConfiguration({ SERVICE_PAYMENT_PAYER: '0x123' }).variables[0].status).toContain(
    'Invalid',
  );
  expect(
    serviceConfiguration({ SERVICE_PAYMENT_PAYER: payer, SERVICE_PAYMENT_RECIPIENT: payer })
      .partiesValid,
  ).toBe(false);
  const result = serviceConfiguration({
    SERVICE_PAYMENT_PAYER: payer,
    SERVICE_PAYMENT_RECIPIENT: recipient,
    TATUM_API_KEY: 'synthetic-private-value',
    ENABLE_AGENT_PAYMENTS: 'true',
  });
  expect(result.partiesValid).toBe(true);
  expect(result.controlVerification).toContain('Incomplete');
  expect(JSON.stringify(result)).not.toContain('synthetic-private-value');
  expect(result.variables.find((v) => v.name === 'ENABLE_AGENT_PAYMENTS')?.status).toContain(
    'Invalid',
  );
});
it('does not confuse coin-object funds, insufficient address balance and usable payment funds', () => {
  expect(fundingState('0', '999999999')).toContain('Conversion required');
  expect(fundingState('999999', '0')).toContain('Insufficient');
  expect(fundingState('1000000', '0')).toContain('Sufficient');
  expect(formatSui('1000000')).toBe('0.001');
  expect(formatSui('9007199254740993')).toBe('9007199.254740993');
});
