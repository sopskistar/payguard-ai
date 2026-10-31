export type ServiceDiagnostic = { stage: string; code: string; message: string; checkedAt: string };

// Never echo serialized signatures, JWTs or known server credentials.
export function serviceDiagnostic(
  stage: string,
  error: unknown,
  secrets: string[] = [],
): ServiceDiagnostic {
  const e = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
  const nested = e.error && typeof e.error === 'object' ? (e.error as Record<string, unknown>) : {};
  let message = [
    e.invalidReason,
    e.errorReason,
    e.message,
    e.errorMessage,
    typeof e.error === 'string' ? e.error : undefined,
    nested.message,
    typeof error === 'string' ? error : undefined,
  ].find((v) => typeof v === 'string') as string | undefined;
  message = (message || 'Provider supplied no readable reason.').slice(0, 4000);
  for (const secret of secrets)
    if (secret.length >= 8) message = message.split(secret).join('[redacted]');
  message = message
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted token]')
    .replace(/[A-Za-z0-9+/_=-]{80,}/g, '[redacted signing data]')
    .replace(/[\u0000-\u001f]/g, ' ')
    .slice(0, 500);
  const code = String(e.code ?? e.errorCode ?? 'PROVIDER_ERROR')
    .replace(/[^a-zA-Z0-9_.-]/g, '')
    .slice(0, 60);
  return { stage, code, message, checkedAt: new Date().toISOString() };
}
