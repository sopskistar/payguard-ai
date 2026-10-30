import { registerBrowserDiagnostics } from './browser-helpers';
import { test, expect } from '@playwright/test';
import { visit } from './browser-helpers';
import recordedPreflight from '../../docs/evidence/production-payment-preflight.json' with { type: 'json' };
const origin = process.env.E2E_BASE_URL || 'http://localhost:3000';
registerBrowserDiagnostics();
test('owner service page explains exact Mainnet proposal and keeps spending disabled', async ({
  browser,
}) => {
  test.skip(
    !process.env.E2E_OWNER_PASSWORD,
    'Requires privately configured owner access; no spending',
  );
  const context = await browser.newContext();
  try {
    const login = await context.request.post('/api/auth/login', {
      headers: { origin },
      data: { password: process.env.E2E_OWNER_PASSWORD },
    });
    expect(login.status()).toBe(200);
    const metadata = await context.request.get('/api/service-payments');
    expect(metadata.status()).toBe(200);
    const info = await metadata.json();
    expect(info.mainnetImplemented).toBe(true);
    expect(info.signingAllowed).toBe(false);
    const page = await context.newPage();
    await visit(page, '/services');
    await expect(page.getByRole('heading', { name: 'Pay for deeper evidence.' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Check Mainnet proposal/ })).toBeVisible();
    await expect(
      page.getByText(/No genuine service settlement has been demonstrated/),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    // A recorded fixture exercises the expanded layout locally. Production uses the actual API.
    if (process.env.LIVE_CHAIN_TEST !== '1')
      await page.route('**/api/service-payments/preflight', (route) =>
        route.fulfill({ json: { ...recordedPreflight, payer: null, recipient: null } }),
      );
    await page.getByRole('button', { name: /Check Mainnet proposal/ }).click();
    await expect(page.getByRole('heading', { name: 'Read-only purchase preflight' })).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText('sui:mainnet', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Merchant recipient', { exact: true })).toBeVisible();
    await expect(page.getByText(/Proposal is incomplete|Parties are configured/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByText('Read-only chain proof and risk details', { exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    await context.request.post('/api/auth/logout', { headers: { origin }, data: {} });
    await context.close();
  }
});
