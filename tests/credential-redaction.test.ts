import { it, expect, vi } from 'vitest';
import CredentialRedactionReporter, {
  redactText,
  redactError,
} from './credential-redaction-reporter';
it('redacts credential values in nested browser errors, including escaped representations', () => {
  const secret = 'synthetic-password-"quoted"-for-test';
  const error = {
    message: 'failed fill: ' + secret,
    stack: 'request ' + encodeURIComponent(secret),
    cause: { snapshot: JSON.stringify({ password: secret }) },
  };
  redactError(error, [secret]);
  expect(JSON.stringify(error)).not.toContain(secret);
  expect(error.message).toBe('failed fill: [REDACTED]');
  expect(error.stack).toBe('request [REDACTED]');
  expect(error.cause.snapshot).toBe('{"password":"[REDACTED]"}');
  expect(redactText('Public data remains readable.', [secret])).toBe(
    'Public data remains readable.',
  );
});

it('cleans text attachments and test failures before downstream reporters embed them', async () => {
  const secret = 'synthetic-artifact-password-for-regression';
  vi.stubEnv('E2E_OWNER_PASSWORD', secret);
  try {
    const reporter = new CredentialRedactionReporter();
    reporter.onBegin();
    const result = {
      errors: [{ message: 'Login failed ' + secret }],
      steps: [{ title: 'Fill ' + secret, steps: [], error: { message: secret } }],
      attachments: [
        {
          name: 'error-context',
          contentType: 'text/markdown',
          body: Buffer.from('entered password: ' + secret),
        },
      ],
    };
    reporter.onTestEnd(
      {} as Parameters<typeof reporter.onTestEnd>[0],
      result as unknown as Parameters<typeof reporter.onTestEnd>[1],
    );
    expect(result.errors[0].message).toBe('Login failed [REDACTED]');
    expect(result.steps[0].title).toBe('Fill [REDACTED]');
    expect(result.steps[0].error.message).toBe('[REDACTED]');
    expect(result.attachments[0].body.toString()).toBe('entered password: [REDACTED]');
  } finally {
    vi.unstubAllEnvs();
  }
});
