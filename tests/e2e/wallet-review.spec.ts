import { test, expect, type Page } from '@playwright/test';
import { visit, registerBrowserDiagnostics } from './browser-helpers';
registerBrowserDiagnostics();
const address = '0x' + '4'.repeat(64);
async function fixture(page: Page, deny = false) {
  await page.addInitScript(
    ({ address, deny }) => {
      const calls = { connect: 0, disconnect: 0, personal: 0, transaction: 0, execute: 0 };
      (window as unknown as { reviewCalls: typeof calls }).reviewCalls = calls;
      const account = {
        address,
        publicKey: new Uint8Array(32),
        chains: ['sui:mainnet'],
        features: [
          'sui:signPersonalMessage',
          'sui:signTransaction',
          'sui:signAndExecuteTransaction',
        ],
      };
      const listeners = new Set<(event: unknown) => void>();
      let accounts = [account]; // A previously authorized fixture must still never auto-connect.
      const wallet = {
        version: '1.0.0',
        name: 'PayGuard Review Fixture',
        icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=',
        chains: ['sui:mainnet'],
        get accounts() {
          return accounts;
        },
        features: {
          'standard:connect': {
            version: '1.0.0',
            connect: async () => {
              calls.connect++;
              if (deny) throw new Error('Synthetic fixture denied the connection');
              accounts = [account];
              listeners.forEach((l) => l({ accounts }));
              return { accounts };
            },
          },
          'standard:disconnect': {
            version: '1.0.0',
            disconnect: async () => {
              calls.disconnect++;
              accounts = [];
              listeners.forEach((l) => l({ accounts }));
            },
          },
          'standard:events': {
            version: '1.0.0',
            on: (_event: string, listener: (event: unknown) => void) => {
              listeners.add(listener);
              return () => listeners.delete(listener);
            },
          },
          'sui:signPersonalMessage': {
            version: '1.1.0',
            signPersonalMessage: async () => {
              calls.personal++;
              throw new Error('Review must never sign');
            },
          },
          'sui:signTransaction': {
            version: '2.0.0',
            signTransaction: async () => {
              calls.transaction++;
              throw new Error('Review must never sign');
            },
          },
          'sui:signAndExecuteTransaction': {
            version: '2.0.0',
            signAndExecuteTransaction: async () => {
              calls.execute++;
              throw new Error('Review must never execute');
            },
          },
        },
      };
      const register = (api: { register: (wallet: unknown) => void }) => api.register(wallet);
      window.addEventListener('wallet-standard:app-ready', (e) =>
        register((e as CustomEvent).detail),
      );
      window.dispatchEvent(
        new CustomEvent('wallet-standard:register-wallet', { detail: register }),
      );
    },
    { address, deny },
  );
}
const counts = (page: Page) =>
  page.evaluate(() => (window as unknown as { reviewCalls: Record<string, number> }).reviewCalls);
test('public official review selector connects only by choice, never signs or authenticates, and disconnects', async ({
  page,
  request,
}) => {
  await fixture(page);
  const forbidden: string[] = [];
  page.on('request', (r) => {
    if (/\/api\/(auth\/wallet|auth\/login|service-payments|memory)|fullnode\./.test(r.url()))
      forbidden.push(new URL(r.url()).pathname);
  });
  await visit(page, '/connect?mode=review');
  await expect(page.getByRole('button', { name: 'Open Slush Security Review' })).toBeVisible();
  expect((await counts(page)).connect).toBe(0);
  expect(await page.locator('mysten-dapp-kit-connect-modal').count()).toBe(0);
  await page.getByRole('button', { name: 'Open Slush Security Review' }).click();
  const wallet = page.getByRole('button', { name: /PayGuard Review Fixture/ });
  await expect(wallet).toBeVisible();
  expect((await counts(page)).connect).toBe(0);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Choose wallet for security review' }).click();
  await wallet.click();
  await expect(page.getByRole('button', { name: 'Disconnect review connection' })).toBeVisible();
  expect(await page.locator('body').innerText()).not.toContain(address);
  expect(
    await page.evaluate((a) => Object.values(localStorage).some((v) => v.includes(a)), address),
  ).toBe(false);
  expect((await (await request.get('/api/auth/session')).json()).authenticated).toBe(false);
  expect((await request.get('/api/preferences')).status()).toBe(401);
  expect((await request.get('/api/service-payments')).status()).toBe(401);
  await page.getByRole('button', { name: 'Disconnect review connection' }).click();
  expect(await counts(page)).toEqual({
    connect: 1,
    disconnect: 1,
    personal: 0,
    transaction: 0,
    execute: 0,
  });
  expect(forbidden).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('wallet refusal remains with the official selector; no signature or fallback login follows', async ({
  page,
}) => {
  await fixture(page, true);
  await visit(page, '/connect?mode=review');
  await page.getByRole('button', { name: 'Open Slush Security Review' }).click();
  await page.getByRole('button', { name: /PayGuard Review Fixture/ }).click();
  await expect(page.getByText('Connection failed', { exact: true })).toBeVisible();
  expect(await counts(page)).toEqual({
    connect: 1,
    disconnect: 0,
    personal: 0,
    transaction: 0,
    execute: 0,
  });
  await expect(page.getByRole('button', { name: /sign message|prepare sign-in/i })).toHaveCount(0);
});
