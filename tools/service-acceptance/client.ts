import { readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { request, type APIRequestContext } from '@playwright/test';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { ACCEPTANCE_ORIGIN, ACCEPTANCE_PAYER, requireExactCustomer } from './contract';

export async function localTestSigner() {
  const file = homedir() + '/.config/payguard-test/sui.key';
  const information = await stat(file);
  if (!information.isFile() || (information.mode & 0o077) !== 0)
    throw Error('TEST_KEY_FILE_PERMISSIONS');
  let decoded;
  try {
    decoded = decodeSuiPrivateKey((await readFile(file, 'utf8')).trim());
  } catch {
    throw Error('LOCAL_TEST_KEY_ENCODING');
  }
  if (decoded.scheme !== 'ED25519') {
    decoded.secretKey.fill(0);
    throw Error('TEST_KEY_SCHEME');
  }
  // Keep the signer's copy separate before clearing the temporary decode buffer.
  const signer = Ed25519Keypair.fromSecretKey(Uint8Array.from(decoded.secretKey));
  decoded.secretKey.fill(0);
  requireExactCustomer(signer.toSuiAddress());
  return signer;
}
export async function api<T>(
  context: APIRequestContext,
  path: string,
  body?: unknown,
  expectedStatus?: number,
) {
  const url = new URL(path, ACCEPTANCE_ORIGIN);
  if (url.origin !== ACCEPTANCE_ORIGIN || !url.pathname.startsWith('/api/'))
    throw Error('API_ORIGIN');
  const response =
    body === undefined
      ? await context.get(url.toString(), { maxRetries: 0, maxRedirects: 0 })
      : await context.post(url.toString(), { data: body, maxRetries: 0, maxRedirects: 0 });
  if (expectedStatus ? response.status() !== expectedStatus : !response.ok())
    throw Error('API_HTTP_' + response.status());
  return (await response.json()) as T;
}
export async function authenticateTestCustomer(signer: Ed25519Keypair) {
  requireExactCustomer(signer.toSuiAddress());
  const context = await request.newContext({
    baseURL: ACCEPTANCE_ORIGIN,
    extraHTTPHeaders: { origin: ACCEPTANCE_ORIGIN },
    timeout: 45000,
  });
  try {
    const challenge = await api<{ id: string; message: string }>(
      context,
      '/api/auth/wallet/challenge',
      { address: ACCEPTANCE_PAYER },
    );
    const signed = await signer.signPersonalMessage(new TextEncoder().encode(challenge.message));
    await api(context, '/api/auth/wallet/verify', {
      id: challenge.id,
      address: ACCEPTANCE_PAYER,
      signature: signed.signature,
    });
    return context;
  } catch (error) {
    await context.dispose();
    throw error;
  }
}
