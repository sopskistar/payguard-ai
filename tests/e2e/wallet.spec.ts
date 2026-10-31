import { registerBrowserDiagnostics } from './browser-helpers';
import { visit } from './browser-helpers';
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
const origin = process.env.E2E_BASE_URL || 'http://localhost:3000';
// Account/signature fixtures run only on isolated loopback; never create test accounts on Neon.
test.beforeEach(async ({ request }) => {
  const status = await request.get('/api/auth/wallet/status');
  expect(status.status()).toBe(200);
  test.skip(
    !(await status.json()).allowed ||
      !['localhost', '127.0.0.1'].includes(new URL(origin).hostname),
    'Signature/account fixtures require isolated loopback; physical hosted provider tests remain separate.',
  );
});
async function authenticate(context: BrowserContext, key: Ed25519Keypair) {
  const challengeResponse = await context.request.post('/api/auth/wallet/challenge', {
    headers: { origin },
    data: { address: key.toSuiAddress() },
  });
  expect(challengeResponse.status()).toBe(200);
  const c = await challengeResponse.json();
  const signed = await key.signPersonalMessage(new TextEncoder().encode(c.message));
  const proof = { id: c.id, address: key.toSuiAddress(), signature: signed.signature };
  const result = await context.request.post('/api/auth/wallet/verify', {
    headers: { origin },
    data: proof,
  });
  expect(result.status()).toBe(200);
  return proof;
}
async function injectWallet(page: Page, key: Ed25519Keypair) {
  await page.exposeBinding('signTestPersonalMessage', async (_source, bytes: number[]) =>
    key.signPersonalMessage(new Uint8Array(bytes)),
  );
  const switched = Ed25519Keypair.generate();
  await page.addInitScript(
    ({ address, publicKey, nextAddress, nextKey }) => {
      const account = {
        address,
        publicKey: new Uint8Array(publicKey),
        chains: ['sui:mainnet'],
        features: ['sui:signPersonalMessage', 'sui:signTransaction'],
      };
      const listeners = new Set<(e: unknown) => void>();
      let accounts: (typeof account)[] = [];
      (window as unknown as { switchTestWallet: () => void }).switchTestWallet = () => {
        accounts = [{ ...account, address: nextAddress, publicKey: new Uint8Array(nextKey) }];
        listeners.forEach((l) => l({ accounts }));
      };
      const wallet = {
        version: '1.0.0',
        name: 'PayGuard Test Wallet',
        icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiI+PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiBmaWxsPSIjOWNmNWQwIi8+PC9zdmc+',
        get accounts() {
          return accounts;
        },
        chains: ['sui:mainnet'],
        features: {
          'standard:connect': {
            version: '1.0.0',
            connect: async () => {
              accounts = [account];
              listeners.forEach((l) => l({ accounts }));
              return { accounts };
            },
          },
          'standard:disconnect': {
            version: '1.0.0',
            disconnect: async () => {
              accounts = [];
              listeners.forEach((l) => l({ accounts }));
            },
          },
          'standard:events': {
            version: '1.0.0',
            on: (_event: string, listener: (e: unknown) => void) => {
              listeners.add(listener);
              return () => listeners.delete(listener);
            },
          },
          'sui:signTransaction': {
            version: '2.0.0',
            signTransaction: async () => {
              throw new Error('Login must never request a transaction signature.');
            },
          },
          'sui:signPersonalMessage': {
            version: '1.1.0',
            signPersonalMessage: async ({ message }: { message: Uint8Array }) =>
              (
                window as unknown as {
                  signTestPersonalMessage: (bytes: number[]) => Promise<unknown>;
                }
              ).signTestPersonalMessage(Array.from(message)),
          },
        },
      };
      const register = ({ register }: { register: (wallet: unknown) => void }) => register(wallet);
      window.addEventListener('wallet-standard:app-ready', ((event: CustomEvent) =>
        register(event.detail)) as EventListener);
      window.dispatchEvent(
        new CustomEvent('wallet-standard:register-wallet', { detail: register }),
      );
    },
    {
      address: key.toSuiAddress(),
      publicKey: Array.from(key.getPublicKey().toRawBytes()),
      nextAddress: switched.toSuiAddress(),
      nextKey: Array.from(switched.getPublicKey().toRawBytes()),
    },
  );
}
registerBrowserDiagnostics();
test('wallet sign-in uses a real personal signature; logout, replay and cross-user APIs are enforced', async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const alice = Ed25519Keypair.generate(),
    bob = Ed25519Keypair.generate();
  try {
    const proof = await authenticate(a, alice);
    expect((await (await a.request.get('/api/auth/session')).json()).role).toBe('member');
    const snap = await (await a.request.get('/api/snapshot')).json();
    expect(snap.mode).toBe('member');
    expect(snap.invoices).toHaveLength(0);
    expect(snap.memories).toHaveLength(0);
    expect(
      (
        await a.request.post('/api/auth/wallet/verify', { headers: { origin }, data: proof })
      ).status(),
    ).toBe(401);
    for (const route of ['memory/seed', 'demo/seed', 'demo/reset', 'integrations/health'])
      expect(
        (await a.request.post('/api/' + route, { headers: { origin }, data: {} })).status(),
        route,
      ).toBe(403);
    expect((await a.request.get('/api/service-payments')).status()).toBe(403);
    const supplier = await a.request.post('/api/vendors', {
      headers: { origin },
      data: { name: 'Synthetic wallet QA supplier' },
    });
    expect(supplier.status()).toBe(201);
    const vendorId = (await supplier.json()).id;
    const created = await a.request.post('/api/invoices', {
      headers: { origin },
      data: {
        vendor: 'Synthetic wallet QA supplier',
        number: 'WALLET-QA-' + Date.now(),
        issued: '2026-10-28',
        due: '2026-11-28',
        amount: '100',
        currency: 'USD',
        memo: 'Synthetic account isolation test',
        recipient: '0x' + '2'.repeat(64),
        wallet: '',
        coinType: '0x2::sui::SUI',
        tokenAmount: '1',
        source: 'manual',
        isDemo: false,
        importKey: crypto.randomUUID(),
      },
    });
    expect(created.status()).toBe(201);
    const id = (await created.json()).id;
    await authenticate(b, bob);
    expect((await (await b.request.get('/api/snapshot')).json()).invoices).toHaveLength(0);
    const watch = await a.request.post('/api/wallets', {
      headers: { origin },
      data: { address: '0x' + '3'.repeat(64), label: 'Synthetic private watch' },
    });
    expect(watch.status()).toBe(200);
    const watchId = (await watch.json()).id;
    for (const route of ['wallets/refresh', 'wallets/remove'])
      expect(
        (
          await b.request.post('/api/' + route, { headers: { origin }, data: { id: watchId } })
        ).status(),
      ).toBe(404);
    expect((await (await b.request.get('/api/snapshot')).json()).wallets).toHaveLength(0);
    expect(
      (
        await b.request.post('/api/invoices/status', {
          headers: { origin },
          data: { invoiceId: id, status: 'approved', reason: 'Synthetic foreign-record attempt' },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await b.request.post('/api/payments/verify', {
          headers: { origin },
          data: { invoiceId: id, digest: 'os1iG8zow278c6hqxbuyxnvMUjzThsD8GTY8atdfzW6' },
        })
      ).status(),
    ).toBe(404);
    for (const route of ['approve', 'cancel', 'remember', 'resume'])
      expect(
        (
          await b.request.post('/api/service-payments/' + id + '/' + route, {
            headers: { origin },
            data: {},
          })
        ).status(),
      ).toBe(403);
    await a.request.post('/api/wallets/remove', { headers: { origin }, data: { id: watchId } });
    for (const route of ['review', 'instructions/context', 'corrections']) {
      const data =
        route === 'review'
          ? { invoiceId: id, memoryOn: true }
          : route === 'corrections'
            ? {
                invoiceId: id,
                findingId: 'recipient-change',
                action: 'remember',
                explanation: 'Synthetic cross-tenant blocked operation',
                scope: 'vendor',
                future: true,
                kind: 'verify_address',
                value: '',
                hard: false,
                consent: true,
                operationKey: crypto.randomUUID(),
              }
            : { invoiceId: id };
      expect(
        (await b.request.post('/api/' + route, { headers: { origin }, data })).status(),
        route,
      ).toBe(404);
    }
    expect((await b.request.delete('/api/invoices/' + id, { headers: { origin } })).status()).toBe(
      404,
    );
    expect(
      (
        await b.request.post('/api/vendors/trust', {
          headers: { origin },
          data: {
            vendorId,
            trustedRecipient: '0x' + '1'.repeat(64),
            emailDomain: 'example.com',
            contactLabel: 'Known supplier contact',
            contactMethod: 'phone',
            contactReference: 'Existing directory',
            establishedAt: '2026-10-01T00:00:00.000Z',
            independentlySourced: true,
          },
        })
      ).status(),
    ).toBe(404);
    const p = await a.newPage();
    const loaded = p.waitForResponse(
      (r) => r.url().endsWith('/api/snapshot') && r.request().method() === 'GET',
      { timeout: 30000 },
    );
    await visit(p, '/app');
    const response = await loaded;
    expect(response.status()).toBe(200);
    expect((await response.json()).mode).toBe('member');
    await expect(p.getByText('Your wallet workspace', { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(p.getByRole('heading', { name: 'Your first payment review' })).toBeVisible();
    await p.route('**/api/auth/logout', (route) => route.abort('failed'), { times: 1 });
    await p.route(
      '**/api/snapshot',
      (route) =>
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Synthetic refresh outage' }),
        }),
      { times: 1 },
    );
    await p.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(
      p.getByRole('heading', { name: 'Private data hidden', exact: true }),
    ).toBeVisible();
    await p.getByRole('button', { name: 'Retry sign-out', exact: true }).click();
    await expect(p.locator('.toast')).toContainText('could not refresh');
    await expect(p.getByRole('heading', { name: 'Recent invoices', exact: true })).toHaveCount(0);
    await p.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(p.getByText('Public demo', { exact: true })).toBeVisible();
    expect((await (await a.request.get('/api/auth/session')).json()).authenticated).toBe(false);
    await authenticate(a, alice);
    expect(
      (await (await a.request.get('/api/snapshot')).json()).invoices.some(
        (i: { id: string }) => i.id === id,
      ),
    ).toBe(true);
    await a.request.delete('/api/invoices/' + id, { headers: { origin } });
  } finally {
    await a.close();
    await b.close();
  }
});
test('Wallet Standard connect UI signs in, switches accounts safely and fits mobile', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const key = Ed25519Keypair.generate();
  await injectWallet(page, key);
  try {
    await visit(page, '/connect?mode=signin');
    await expect(page.getByRole('heading', { name: 'Connect Sui Wallet' })).toBeVisible();
    await page.getByRole('button', { name: 'Connect Wallet', exact: true }).click();
    await page.getByText('PayGuard Test Wallet', { exact: true }).click();
    await expect(page.getByText('Wallet connected.', { exact: false })).toBeVisible();
    expect((await (await context.request.get('/api/auth/session')).json()).authenticated).toBe(
      false,
    );
    await page.getByRole('button', { name: 'Prepare sign-in message' }).click();
    await expect(page.locator('.wallet-message pre')).toContainText(
      'does not authorize any transaction',
    );
    await page.getByRole('button', { name: 'Sign message & open workspace' }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText('Your wallet workspace', { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    // Standard wallet account-change event must revoke the previous session.
    await page.route('**/api/auth/logout', (route) => route.abort('failed'), { times: 1 });
    await page.evaluate(() =>
      (window as unknown as { switchTestWallet: () => void }).switchTestWallet(),
    );
    await expect(
      page.getByRole('heading', { name: 'Private data hidden', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Retry sign-out', exact: true }).click();
    await expect(page.getByText('Public demo', { exact: true })).toBeVisible();
    expect((await (await context.request.get('/api/auth/session')).json()).authenticated).toBe(
      false,
    );
  } finally {
    await context.close();
  }
});

test('wallet loading provides native recovery when JavaScript cannot load', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await visit(page, '/connect?mode=signin');
    await expect(page.getByRole('heading', { name: 'Connect Sui Wallet' })).toBeVisible();
    const reload = page.getByRole('button', { name: 'Reload wallet connection' });
    await expect(reload).toBeVisible();
    await Promise.all([page.waitForNavigation(), reload.click()]);
    await expect(page).toHaveURL(/\/connect\?mode=signin$/);
    await expect(reload).toBeVisible();
    await visit(page, '/app');
    await expect(page.getByRole('heading', { name: 'Preparing your workspace' })).toBeVisible();
    const workspaceReload = page.getByRole('button', { name: 'Reload workspace', exact: true });
    await Promise.all([page.waitForNavigation(), workspaceReload.click()]);
    await expect(workspaceReload).toBeVisible();
  } finally {
    await context.close();
  }
});
