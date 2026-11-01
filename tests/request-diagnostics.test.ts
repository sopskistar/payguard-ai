import { it, expect } from 'vitest';
import { requestFailure } from '@/lib/request-diagnostics';
import { AppError } from '@/lib/errors';
it('classifies wrapped Neon socket errors without returning query, payload or driver text', () => {
  const secret = 'private-password-and-signature-canary';
  const error = Object.assign(new Error('Failed query ' + secret), {
    query: 'insert ' + secret,
    params: [secret],
    cause: { type: 'error', message: secret, error: { code: 'ECONNRESET', message: secret } },
  });
  const result = requestFailure(error, 'terms-approval');
  expect(result.status).toBe(503);
  expect(result.code).toBe('DATABASE_CONNECTION');
  expect(result.diagnostic.stage).toBe('terms-approval');
  expect(JSON.stringify(result)).not.toContain(secret);
  expect(result.diagnostic.action).toContain('Never repeat a signature');
});
it.each([
  ['AUTH_REQUIRED', 'authentication'],
  ['SESSION_CAP', 'exposure'],
  ['SPENDING_SESSION', 'reservation'],
  ['QUOTE_EXPIRED', 'expiry'],
  ['FACILITATOR_HTTP_503', 'facilitator'],
  ['SETTLEMENT_FAILED', 'tatum'],
  ['RATE_LIMIT', 'quota'],
])('keeps %s separate from a physical wallet refusal', (code, category) => {
  const r = requestFailure(new AppError(409, code, 'Known safe reason'), 'payment-resume');
  expect(r.diagnostic.category).toBe(category);
  expect(r.code).toBe(code);
});
it('does not serialize an unexpected exception or private signing payload', () => {
  const r = requestFailure(
    { message: 'secret', signature: 'secret', transaction: 'secret', cookie: 'secret' },
    'settlement-request',
  );
  expect(JSON.stringify(r)).not.toContain('secret');
  expect(r.diagnostic.action).toContain('Do not sign or submit again');
});
