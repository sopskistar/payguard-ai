import { serviceAddressSchema } from '../../src/lib/service-protocol';
export class LocalOwnerError extends Error {}

// This is a launcher for the existing application, never another settlement backend.
export function localOwnerConfig(
  source: Record<string, string | undefined>,
  parties: Record<string, string | undefined>,
  enableSettlement = false,
) {
  if (source.VERCEL || source.CI)
    throw new LocalOwnerError('Owner-local mode cannot run on hosted or CI infrastructure.');
  for (const name of ['DATABASE_URL', 'TATUM_API_KEY', 'AUTH_SECRET', 'OWNER_PASSWORD'])
    if (!source[name])
      throw new LocalOwnerError(`${name} is missing from the private local configuration.`);
  if (source.AUTH_SECRET!.length < 32 || source.OWNER_PASSWORD!.length < 16)
    throw new LocalOwnerError('The existing owner authentication configuration is incomplete.');
  const payer = serviceAddressSchema.parse(
    source.SERVICE_PAYMENT_PAYER || parties.SERVICE_PAYMENT_PAYER,
  );
  const recipient = serviceAddressSchema.parse(
    source.SERVICE_PAYMENT_RECIPIENT || parties.SERVICE_PAYMENT_RECIPIENT,
  );
  if (payer === recipient) throw new LocalOwnerError('Payer and merchant must differ.');
  if (
    (parties.SERVICE_PAYMENT_PAYER && payer !== parties.SERVICE_PAYMENT_PAYER) ||
    (parties.SERVICE_PAYMENT_RECIPIENT && recipient !== parties.SERVICE_PAYMENT_RECIPIENT)
  )
    throw new LocalOwnerError(
      'Local parties differ from the authenticated Production configuration.',
    );
  return {
    ...source,
    NODE_ENV: 'production',
    APP_URL: 'http://localhost:4320',
    ENABLE_AGENT_PAYMENTS: 'mainnet',
    SERVICE_PAYMENT_SETTLEMENT_ENABLED: enableSettlement ? 'true' : 'false',
    SERVICE_PAYMENT_PAYER: payer,
    SERVICE_PAYMENT_RECIPIENT: recipient,
    LOCAL_DATABASE_PATH: '',
  } as NodeJS.ProcessEnv;
}
