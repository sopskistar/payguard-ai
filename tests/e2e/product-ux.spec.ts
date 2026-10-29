import { test, expect } from '@playwright/test';
test('refresh shows loading, honest success, timestamp and failure; public actions explain owner access', async ({
  page,
}) => {
  await page.goto('/app');
  await expect(page.getByText('Public demo', { exact: true })).toBeVisible();
  await expect(page.getByText('Published Mainnet proof', { exact: false })).toBeVisible();
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  await page.route(
    '**/api/snapshot',
    async (route) => {
      await gate;
      await route.continue();
    },
    { times: 1 },
  );
  const button = page.getByRole('button', { name: 'Refresh workspace' });
  await button.click();
  await expect(button).toContainText('Refreshing');
  await expect(button).toBeDisabled();
  release();
  await expect(page.getByRole('status')).toContainText('Sample data is up to date');
  await expect(page.locator('.workspace-refresh-time time')).toBeVisible();
  await page.route(
    '**/api/snapshot',
    (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Temporary test outage' }),
      }),
    { times: 1 },
  );
  await button.click();
  await expect(page.locator('.toast')).toContainText('Refresh failed');
  await expect(page.locator('.toast')).not.toContainText('up to date');
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('up to date');
  await page.getByRole('button', { name: 'Add invoice', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('administrator');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('link', { name: /^Memory Lab/ }).click();
  await expect(page.getByRole('heading', { name: /Memory works across sessions/ })).toBeVisible();
  await page.getByRole('button', { name: 'Memory ON', exact: true }).click();
  await expect(page.locator('.public-memory-result')).toContainText('confirmed citations');
});
test('landing CTAs, FAQ, proof and mobile layouts are deliberate and functional', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Same supplier/ })).toBeVisible();
  await page.getByRole('button', { name: 'Memory ON', exact: true }).click();
  await expect(page.locator('.site-citation code')).toBeVisible();
  await page
    .getByText('Can anyone create an account or connect a wallet?', { exact: true })
    .click();
  await expect(page.getByText(/Connect Sui Wallet creates an individual account/)).toBeVisible();
  await page.getByRole('link', { name: 'Owner Sign In', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('public demo');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.goto('/proof');
  await expect(page.getByRole('heading', { name: '30 confirmed memories.' })).toBeVisible();
  await page.getByText('Inspect all job IDs, blobs and completion times', { exact: true }).click();
  await expect(page.locator('.proof-receipts article')).toHaveCount(30);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    '/',
    '/try',
    '/app',
    '/app/replay',
    '/app/memory',
    '/proof',
    '/connect',
    '/privacy',
  ]) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      path,
    ).toBe(true);
  }
  await page.goto('/');
  await page.getByRole('link', { name: 'Try Interactive Demo', exact: true }).first().click();
  await expect(page).toHaveURL(/\/try$/);
});
