import { expect, it } from 'vitest';
import { serviceSigningState } from '@/lib/service-recovery';

const unsigned = { state: 'approved', expired: false, disclosed: false, submitted: false };
it('distinguishes unsigned, expired, declined, failed, uncertain and returned signatures', () => {
  expect(serviceSigningState(unsigned)).toBe('prepared-unsigned');
  expect(serviceSigningState({ ...unsigned, expired: true })).toBe('expired');
  expect(serviceSigningState({ ...unsigned, walletPhase: 'service.wallet_requested' })).toBe(
    'signature-uncertain',
  );
  expect(
    serviceSigningState({ ...unsigned, walletPhase: 'service.wallet_error', walletCode: '4001' }),
  ).toBe('signature-declined');
  expect(
    serviceSigningState({
      ...unsigned,
      walletPhase: 'service.wallet_error',
      walletCode: 'PROVIDER_ERROR',
    }),
  ).toBe('signature-failed');
  expect(serviceSigningState({ ...unsigned, walletPhase: 'service.wallet_signed' })).toBe(
    'signed-unsubmitted',
  );
});
it('gives server disclosure and execution evidence precedence over wallet diagnostics and expiry', () => {
  const declined = {
    ...unsigned,
    expired: true,
    walletPhase: 'service.wallet_error',
    walletCode: '4001',
  };
  expect(serviceSigningState({ ...declined, disclosed: true })).toBe('submitted');
  expect(serviceSigningState({ ...declined, submitted: true })).toBe('submitted');
  expect(serviceSigningState({ ...declined, state: 'settled' })).toBe('settled');
  expect(serviceSigningState({ ...declined, state: 'failed' })).toBe('failed');
});
