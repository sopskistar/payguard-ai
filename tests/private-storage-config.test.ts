import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { privateStorageConfigured, privateStorageAuthentication } from '@/lib/documents';

beforeEach(() => {
  for (const name of ['BLOB_READ_WRITE_TOKEN', 'BLOB_STORE_ID', 'VERCEL_OIDC_TOKEN'])
    vi.stubEnv(name, '');
});
afterEach(() => vi.unstubAllEnvs());

it('keeps retained intake disabled without credentials', () => {
  expect(privateStorageConfigured()).toBe(false);
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', '   ');
  expect(privateStorageConfigured()).toBe(false);
});

it('recognizes the existing read-write token path', () => {
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'fixture-token-not-live');
  expect(privateStorageConfigured()).toBe(true);
  expect(privateStorageAuthentication()).toBe('read-write-token');
});

it('reports the SDK precedence when both supported credentials are present', () => {
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'fixture-token-not-live');
  vi.stubEnv('BLOB_STORE_ID', 'store_fixture_not_live');
  vi.stubEnv('VERCEL_OIDC_TOKEN', 'fixture-oidc-not-live');
  expect(privateStorageAuthentication()).toBe('platform-oidc');
});

it('recognizes the complete platform OIDC credential pair without a static token', () => {
  vi.stubEnv('BLOB_STORE_ID', 'store_fixture_not_live');
  vi.stubEnv('VERCEL_OIDC_TOKEN', 'fixture-oidc-not-live');
  expect(privateStorageConfigured()).toBe(true);
  expect(privateStorageAuthentication()).toBe('platform-oidc');
});

it.each(['BLOB_STORE_ID', 'VERCEL_OIDC_TOKEN'])(
  'rejects an incomplete OIDC configuration containing only %s',
  (name) => {
    vi.stubEnv(name, 'fixture-not-live');
    expect(privateStorageConfigured()).toBe(false);
  },
);
