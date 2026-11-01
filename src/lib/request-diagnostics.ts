import { AppError } from './errors';

export type RequestDiagnostic = {
  category: string;
  stage: string;
  code: string;
  message: string;
  action: string;
};

// Classify exceptions without returning SQL, parameters, URLs or arbitrary exception messages.
export function requestFailure(error: unknown, stage: string) {
  const causes: Record<string, unknown>[] = [];
  const visit = (value: unknown, depth = 0) => {
    if (
      !value ||
      typeof value !== 'object' ||
      depth > 4 ||
      causes.includes(value as Record<string, unknown>)
    )
      return;
    const e = value as Record<string, unknown>;
    causes.push(e);
    visit(e.cause, depth + 1);
    visit(e.error, depth + 1);
  };
  visit(error);
  const database = causes.some(
    (e) =>
      typeof e.query === 'string' ||
      /^(NeonDbError|DrizzleQueryError|DatabaseError)$/.test(String(e.name)),
  );
  const socket = causes.some(
    (e) =>
      e.type === 'error' ||
      /^(ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|08006|08001|57P01)$/.test(
        String(e.code),
      ) ||
      (typeof e.message === 'string' &&
        /WebSocket|connection terminated|connection timeout/i.test(e.message)),
  );
  let status = 500;
  let diagnostic: RequestDiagnostic;
  if (database && socket) {
    status = 503;
    diagnostic = {
      category: 'database',
      stage,
      code: 'DATABASE_CONNECTION',
      message: 'The Neon database connection failed during this request.',
      action:
        'Reload workspace/payment status. Verify the saved intent before retrying approval. Never repeat a signature or settlement.',
    };
  } else if (database) {
    diagnostic = {
      category: 'database',
      stage,
      code: 'DATABASE_REQUEST',
      message: 'The database could not complete this operation.',
      action:
        'Inspect the saved payment state before proceeding. A database error is not a wallet rejection.',
    };
  } else if (error instanceof AppError) {
    status = error.status;
    const code = error.code;
    const category = /AUTH|LOGIN|OWNER|ORIGIN|ROLE/.test(code)
      ? 'authentication'
      : /CAP|BUDGET/.test(code)
        ? 'exposure'
        : /SESSION|PREPARED|SUBMITTED|INTENT|RECEIPT|REUSED|SIGNATURE_UNCERTAIN/.test(code)
          ? 'reservation'
          : /EXPIRED|QUOTE_STATE|INSTRUCTION_CHANGED/.test(code)
            ? 'expiry'
            : /FACILITATOR|GAS_TERMS/.test(code)
              ? 'facilitator'
              : /TATUM|SETTLEMENT_FAILED/.test(code)
                ? 'tatum'
                : /RATE_LIMIT/.test(code)
                  ? 'quota'
                  : 'configuration';
    diagnostic = {
      category,
      stage,
      code,
      message: error.message,
      action:
        category === 'authentication'
          ? 'Use Owner administrator sign in, then reload this saved payment.'
          : category === 'expiry'
            ? 'Verify the existing intent. Cancel only a confirmed unsigned, unsubmitted quote before requesting fresh terms.'
            : category === 'exposure'
              ? 'Review the 0.003 SUI session exposure and existing reservations. Do not discard an uncertain payment.'
              : category === 'reservation'
                ? 'Resume the original intent; do not create a replacement payment.'
                : category === 'quota'
                  ? 'Wait for the quota window. No automatic retry will be sent.'
                  : 'Review the named configuration/provider stage. No wallet restriction is inferred from this error.',
    };
  } else {
    diagnostic = {
      category: 'request',
      stage,
      code: 'REQUEST_UNAVAILABLE',
      message: 'This operation did not return a verified result.',
      action:
        'Reload payment status and inspect the saved intent. Do not sign or submit again if an earlier attempt is uncertain.',
    };
  }
  return { status, error: diagnostic.message, code: diagnostic.code, diagnostic };
}
