import { registerBrowserDiagnostics } from './browser-helpers';
import { test, expect } from '@playwright/test';
import { visit } from './browser-helpers';
registerBrowserDiagnostics();
test('public wallet login is accessible independently of hosted financial signing', async ({
  page,
  request,
}) => {
  const status = await request.get('/api/auth/wallet/status');
  expect(status.status()).toBe(200);
  const { allowed, slushBlocked, paymentSigningAllowed } = await status.json();
  expect(allowed).toBe(true);
  expect(slushBlocked).toBe(false);
  if (
    !['localhost', '127.0.0.1'].includes(
      new URL(process.env.E2E_BASE_URL || 'http://localhost:3000').hostname,
    )
  )
    expect(paymentSigningAllowed).toBe(true);
  await visit(page, '/connect?mode=review');
  await expect(
    page.getByRole('heading', { name: 'Wallet security review in progress' }),
  ).toBeVisible();
  await expect(page.getByText(/Stop at any wallet warning or refusal/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Slush Security Review' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect Wallet' })).toHaveCount(0);
  await visit(page, '/connect');
  await expect(
    page.getByRole('heading', { name: 'Connect Sui Wallet', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Free registration · no email, password or funds.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Connect Wallet', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Slush', exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Use existing Slush web account', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: /Try without a wallet/ }).click();
  await expect(page).toHaveURL(/\/try$/);
});

test('wallet registration loads its real controls at 360, 390 and 430px without a recovery screen', async ({
  page,
}) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.name));
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await visit(page, '/connect');
    await expect(
      page.getByRole('heading', { name: 'Connect Sui Wallet', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'We couldn’t open this view.' })).toHaveCount(0);
    const connect = page.getByRole('button', { name: 'Connect Wallet', exact: true });
    await expect(connect).toBeEnabled();
    await connect.click();
    await expect(
      page.getByRole('button', { name: 'Use existing Slush web account', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  }
  expect(failures).toEqual([]);
});
