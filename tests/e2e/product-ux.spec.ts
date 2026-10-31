import { registerBrowserDiagnostics } from './browser-helpers';
import { visit } from './browser-helpers';
import { test, expect } from '@playwright/test';
registerBrowserDiagnostics();
test('refresh shows loading, honest success, timestamp and failure; public actions explain owner access', async ({
  page,
}) => {
  const initialSnapshot = page.waitForResponse(
    async (r) =>
      r.url().endsWith('/api/snapshot') &&
      r.status() === 200 &&
      (await r.json()).mode === 'public-demo',
    { timeout: 20000 },
  );
  await visit(page, '/app');
  const snapshot = await (await initialSnapshot).json();
  const actualHolds = snapshot.invoices.filter(
    (i: { id: string; status: string }) =>
      i.status === 'open' && snapshot.approvalGates?.[i.id]?.allowed === false,
  ).length;
  await expect(page.locator('.work-metrics article').nth(1).locator('strong')).toHaveText(
    String(actualHolds),
  );
  await page.getByText('How this workspace works', { exact: true }).click();
  await expect(page.locator('.work-context-help')).toContainText('current saved instructions');
  await expect(page.getByText('Public demo', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Inspect published Mainnet proof', exact: true }),
  ).toBeVisible();
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
  await visit(page, '/');
  await expect(page.getByRole('heading', { name: /Familiar supplier/ })).toBeVisible();
  await page.getByRole('button', { name: 'Memory ON', exact: true }).click();
  await expect(page.locator('.site-citation code')).toBeVisible();
  await page
    .getByText('Can anyone create an account or connect a wallet?', { exact: true })
    .click();
  await expect(
    page.getByText(/Slush production login remains under security review/),
  ).toBeVisible();
  const actions = page.locator('.site-hero-actions');
  const primary = await actions.getByRole('link').nth(0).boundingBox();
  const secondary = await actions.getByRole('link').nth(1).boundingBox();
  expect(primary).not.toBeNull();
  expect(secondary).not.toBeNull();
  const spacing = Math.max(
    secondary!.x - primary!.x - primary!.width,
    secondary!.y - primary!.y - primary!.height,
  );
  expect(spacing).toBeGreaterThanOrEqual(19);
  expect(primary!.height).toBeGreaterThanOrEqual(44);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobilePrimary = await actions.getByRole('link').nth(0).boundingBox();
  const mobileSecondary = await actions.getByRole('link').nth(1).boundingBox();
  expect(mobileSecondary!.y - mobilePrimary!.y - mobilePrimary!.height).toBeGreaterThanOrEqual(19);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('link', { name: 'Owner Sign In', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('public demo');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await visit(page, '/proof');
  await expect(page.getByRole('heading', { name: '30 confirmed memories.' })).toBeVisible();
  await page.getByText('Inspect all job IDs, blobs and completion times', { exact: true }).click();
  await expect(page.locator('#memory .proof-receipts article')).toHaveCount(30);
  await expect(page.locator('#isolation .proof-receipts article')).toHaveCount(2);
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
    await visit(page, path);
    await expect(page.locator('h1')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      path,
    ).toBe(true);
  }
  await visit(page, '/');
  await page.getByRole('link', { name: 'Try Interactive Demo', exact: true }).first().click();
  await expect(page).toHaveURL(/\/try$/);
});

test('owner sign-in clears submitted credentials while the request is pending', async ({
  page,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  await page.route('**/api/auth/login', async (route) => {
    await gate;
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Incorrect owner password.' }),
    });
  });
  await visit(page, '/app?signin=1');
  const input = page.getByLabel('Owner password');
  await input.fill('synthetic-test-only-not-a-real-password');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(input).toHaveValue('');
  release();
  await expect(page.locator('.toast')).toContainText('Incorrect owner password');
  await expect(input).toHaveValue('');
});
