import { serviceAddressSchema, SERVICE_AMOUNT } from './service-protocol';

export type PaymentDiagnostic = {
  stage: string;
  label: string;
  status: 'passed' | 'failed' | 'skipped';
  checkedAt: string;
  classification: string;
  code: string;
  message: string;
  action: string;
};
export class PaymentCheckError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
const checkErrors: Record<string, [string, string, string]> = {
  CONFIGURATION: [
    'configuration',
    'Required payment configuration is missing or invalid.',
    'Review the configuration statuses; preserve existing valid addresses and credentials.',
  ],
  CHAIN_IDENTITY: [
    'validation',
    'Tatum returned a different network or incomplete chain identity.',
    'Do not use these balances. Verify the fixed Sui Mainnet endpoint.',
  ],
  NATIVE_SUI: [
    'validation',
    'Native SUI coin identity or 9-decimal metadata did not match.',
    'Retry the Tatum metadata check before using amounts.',
  ],
  PROTOCOL_FEATURE: [
    'unsupported',
    'Address-balance gas support was not confirmed. Balance reads can still succeed.',
    'Retry compatibility checks; keep settlement disabled.',
  ],
  FACILITATOR_TERMS: [
    'unsupported',
    'Tentacle did not advertise the required x402 v2 exact network and sponsor terms.',
    'Retry compatibility checks; do not substitute gas or recipient terms.',
  ],
  BALANCE_MISSING: [
    'response',
    'No complete native SUI balance result was returned. The balance is unknown.',
    'Retry this wallet balance check; do not treat the missing result as zero.',
  ],
  BALANCE_COMPONENTS: [
    'response',
    'A nonzero total was returned without enough information to determine its coin and address components.',
    'Retry the provider check. Usable address balance remains unknown.',
  ],
  BALANCE_INCONSISTENT: [
    'validation',
    'The returned balance components do not match the explicit total.',
    'Retry this wallet balance check; do not use inconsistent amounts.',
  ],
};
// Never return arbitrary provider messages, URLs, headers or exception objects to the browser.
export function failedPaymentCheck(
  stage: string,
  label: string,
  error: unknown,
): PaymentDiagnostic {
  const raw =
    error && typeof error === 'object'
      ? (error as { code?: unknown; name?: unknown; status?: unknown; message?: unknown })
      : {};
  const numericCodes: Record<number, string> = {
    4: 'DEADLINE_EXCEEDED',
    5: 'NOT_FOUND',
    7: 'PERMISSION_DENIED',
    8: 'RESOURCE_EXHAUSTED',
    12: 'UNIMPLEMENTED',
    13: 'INTERNAL',
    14: 'UNAVAILABLE',
    16: 'UNAUTHENTICATED',
  };
  let code =
    error instanceof PaymentCheckError
      ? error.code
      : typeof raw.code === 'number'
        ? numericCodes[raw.code] || 'UNKNOWN'
        : typeof raw.code === 'string' &&
            /^(DEADLINE_EXCEEDED|NOT_FOUND|PERMISSION_DENIED|RESOURCE_EXHAUSTED|UNIMPLEMENTED|INTERNAL|UNAVAILABLE|UNAUTHENTICATED)$/.test(
              raw.code,
            )
          ? raw.code
          : 'UNKNOWN';
  if (raw.name === 'AbortError' || raw.name === 'TimeoutError') code = 'DEADLINE_EXCEEDED';
  if (raw.status === 401 || raw.status === 403) code = 'UNAUTHENTICATED';
  if (raw.status === 429) code = 'RESOURCE_EXHAUSTED';
  // grpc-js can wrap the gateway's HTTP 429 in UNAVAILABLE. Extract only this
  // fixed status pattern; never expose the provider's arbitrary message.
  const http =
    typeof raw.message === 'string'
      ? /^Received HTTP status code (\d{3})$/.exec(raw.message)
      : null;
  if (http?.[1] === '429') code = 'RESOURCE_EXHAUSTED';
  if (http?.[1] === '401' || http?.[1] === '403') code = 'UNAUTHENTICATED';
  const known = checkErrors[code];
  const [classification, message, action] =
    known ||
    (['UNAUTHENTICATED', 'PERMISSION_DENIED'].includes(code)
      ? [
          'authentication',
          'Provider authentication or access was rejected.',
          'Check the server-only provider credential and permissions in Vercel; do not paste its value here.',
        ]
      : code === 'RESOURCE_EXHAUSTED'
        ? [
            'rate_limit',
            'The provider request quota was reached.',
            'Wait for the provider quota window, then retry.',
          ]
        : code === 'DEADLINE_EXCEEDED'
          ? [
              'timeout',
              'The provider did not respond within the read-only timeout.',
              'Retry this check. No balance or payment success is assumed.',
            ]
          : code === 'UNIMPLEMENTED'
            ? [
                'unsupported',
                'The provider does not support this RPC method.',
                'Check provider method support; do not enable settlement.',
              ]
            : ['UNAVAILABLE', 'INTERNAL'].includes(code)
              ? [
                  'unavailable',
                  'The provider is temporarily unavailable.',
                  'Retry this read-only check; successful checks for the other wallet are retained.',
                ]
              : code === 'NOT_FOUND'
                ? [
                    'response',
                    'The requested balance record was not found. Its value remains unknown.',
                    'Retry this wallet check; a missing record is not a confirmed zero.',
                  ]
                : [
                    'unknown',
                    'This read-only stage could not be verified.',
                    'Retry this stage and inspect its safe status code. No balance or payment success is assumed.',
                  ]);
  return {
    stage,
    label,
    status: 'failed',
    checkedAt: new Date().toISOString(),
    classification,
    code,
    message,
    action,
  };
}
export async function paymentCheck<T>(
  diagnostics: PaymentDiagnostic[],
  stage: string,
  label: string,
  operation: () => Promise<T>,
): Promise<T | null> {
  try {
    const result = await operation();
    diagnostics.push({
      stage,
      label,
      status: 'passed',
      checkedAt: new Date().toISOString(),
      classification: 'verified',
      code: 'OK',
      message: 'Read-only check succeeded.',
      action: '',
    });
    return result;
  } catch (error) {
    diagnostics.push(failedPaymentCheck(stage, label, error));
    return null;
  }
}

export function serviceConfiguration(env: Readonly<Record<string, string | undefined>>) {
  const payer = serviceAddressSchema.safeParse(env.SERVICE_PAYMENT_PAYER);
  const recipient = serviceAddressSchema.safeParse(env.SERVICE_PAYMENT_RECIPIENT);
  const partiesValid = payer.success && recipient.success && payer.data !== recipient.data;
  const variables = [
    {
      name: 'SERVICE_PAYMENT_PAYER',
      status: payer.success
        ? 'Configured'
        : env.SERVICE_PAYMENT_PAYER
          ? 'Invalid public address'
          : 'Missing',
    },
    {
      name: 'SERVICE_PAYMENT_RECIPIENT',
      status: recipient.success
        ? 'Configured'
        : env.SERVICE_PAYMENT_RECIPIENT
          ? 'Invalid public address'
          : 'Missing',
    },
    {
      name: 'ENABLE_AGENT_PAYMENTS',
      status: ['mainnet', 'testnet'].includes(env.ENABLE_AGENT_PAYMENTS || '')
        ? `Quote mode: ${env.ENABLE_AGENT_PAYMENTS}`
        : !env.ENABLE_AGENT_PAYMENTS || env.ENABLE_AGENT_PAYMENTS === 'false'
          ? 'Quotes disabled'
          : 'Invalid: use false, mainnet or testnet',
    },
    {
      name: 'SERVICE_PAYMENT_SETTLEMENT_ENABLED',
      status:
        env.SERVICE_PAYMENT_SETTLEMENT_ENABLED === 'true'
          ? 'Settlement switch on; security gate still applies'
          : !env.SERVICE_PAYMENT_SETTLEMENT_ENABLED ||
              env.SERVICE_PAYMENT_SETTLEMENT_ENABLED === 'false'
            ? 'Settlement disabled'
            : 'Invalid: use false or true',
    },
    ...['DATABASE_URL', 'AUTH_SECRET', 'OWNER_PASSWORD', 'APP_URL', 'TATUM_API_KEY'].map(
      (name) => ({ name, status: env[name] ? 'Present (value hidden)' : 'Missing' }),
    ),
  ];
  return {
    payer: payer.success ? payer.data : null,
    recipient: recipient.success ? recipient.data : null,
    partiesValid,
    variables,
    controlVerification:
      'Incomplete: configuration and balance reads do not prove wallet control. No wallet signature requested.',
  };
}
export type ServiceConfiguration = ReturnType<typeof serviceConfiguration>;
export function formatSui(atomic: string) {
  const value = BigInt(atomic);
  return `${value / 1000000000n}.${(value % 1000000000n).toString().padStart(9, '0').replace(/0+$/, '') || '0'}`;
}
export function fundingState(addressAtomic: string, coinAtomic: string) {
  if (BigInt(addressAtomic) >= BigInt(SERVICE_AMOUNT)) return 'Sufficient address balance';
  if (BigInt(coinAtomic) > 0n)
    return 'Conversion required: coin objects are not usable address balance';
  return 'Insufficient funds';
}
