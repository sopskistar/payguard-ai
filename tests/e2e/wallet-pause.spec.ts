import { registerBrowserDiagnostics } from './browser-helpers';
import { test, expect } from '@playwright/test';
import { visit } from './browser-helpers';
registerBrowserDiagnostics();
test('hosted payment pause and Slush restriction do not disable permitted account authentication', async ({
  page,
  request,
}) => {
  const status = await request.get('/api/auth/wallet/status');
  expect(status.status()).toBe(200);
  const { allowed, slushBlocked, paymentSigningAllowed } = await status.json();
  test.skip(
    !slushBlocked,
    'Security pause applies to hosted origins; local wallet fixtures are enabled.',
  );
  expect(allowed).toBe(true);
  expect(paymentSigningAllowed).toBe(false);
  await visit(page, '/connect?mode=review');
  await expect(
    page.getByRole('heading', { name: 'Wallet security review in progress' }),
  ).toBeVisible();
  await expect(page.getByText(/Do not override wallet warnings/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Slush Security Review' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect Wallet' })).toHaveCount(0);
  await visit(page, '/connect');
  await expect(
    page.getByRole('heading', { name: 'Connect Sui Wallet', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Slush production login remains under security review.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Connect Wallet', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Slush', exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Use existing Slush web account', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('link', { name: /Try without a wallet/ }).click();
  await expect(page).toHaveURL(/\/try$/);
});
