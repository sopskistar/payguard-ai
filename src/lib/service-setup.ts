import { serviceAddressSchema, SERVICE_AMOUNT } from './service-protocol';

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
