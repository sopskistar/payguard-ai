import { visit, signInOwner } from './browser-helpers';
import { test, expect } from '@playwright/test';
const origin = process.env.E2E_BASE_URL || 'http://localhost:3000';
test('public Verify journey, replay controls and responsive navigation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await visit(page, '/');
  await expect(page.getByRole('heading', { name: /Same supplier/ })).toBeVisible();
  await visit(page, '/app/replay');
  await expect(page.getByRole('heading', { name: 'Attack Replay Lab', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Lookalike sender/ }).click();
  await expect(page.getByText('Sender domain differs from the established domain')).toBeVisible();
  await page.getByRole('button', { name: /Show the human verification step/ }).click();
  await expect(page.getByText('Use the established contact', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Unchanged recurring instruction/ }).click();
  await expect(page.getByText('No instruction-change signal was detected')).toBeVisible();
  await visit(page, '/app/invoices');
  await page.getByRole('textbox', { name: 'Search invoices' }).fill('Northstar');
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await visit(page, '/app/review');
  await expect(page.getByRole('heading', { name: 'Verify supplier instructions' })).toBeVisible();
  await page.getByRole('button', { name: 'Memory OFF', exact: true }).click();
  await page.getByRole('button', { name: 'Memory ON', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('requires sign-in');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Vendor Trust', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Vendor Trust', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const path of ['/app', '/app/invoices', '/app/review', '/app/replay', '/app/memory']) {
    await visit(page, path);
    await expect(page.locator('main h1')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      path,
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
test('anonymous users cannot read owner data or mutate records; origin is checked', async ({
  request,
}) => {
  const publicData = await request.get('/api/snapshot');
  expect(publicData.status()).toBe(200);
  expect((await publicData.json()).mode).toBe('public-demo');
  expect((await request.get('/api/preferences')).status()).toBe(401);
  expect((await request.post('/api/memory/seed', { headers: { origin }, data: {} })).status()).toBe(
    401,
  );
  expect(
    (
      await request.post('/api/auth/login', {
        headers: { origin: 'https://untrusted.example' },
        data: { password: 'fixture' },
      })
    ).status(),
  ).toBe(403);
});
test('owner intake persists through a fresh browser context, with no fictional memory', async ({
  browser,
}) => {
  test.skip(
    !process.env.E2E_OWNER_PASSWORD,
    'Set E2E_OWNER_PASSWORD privately to run owner persistence smoke test.',
  );
  const context = await browser.newContext();
  const page = await context.newPage();
  await visit(page, '/app');
  await page.getByRole('button', { name: 'Owner login', exact: true }).first().click();
  await signInOwner(page, process.env.E2E_OWNER_PASSWORD!);
  await page.getByRole('button', { name: 'Add invoice', exact: true }).click();
  await page.getByLabel('Vendor / merchant').fill('E2E supplier');
  const number = `QA-${Date.now()}`;
  await page.getByLabel('Invoice number', { exact: true }).fill(number);
  await page.getByLabel('Invoice amount').fill('42.50');
  const savedResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/invoices') && r.request().method() === 'POST',
    { timeout: 45000 },
  );
  await page.getByRole('button', { name: 'Save & review invoice' }).click();
  expect((await savedResponse).status()).toBe(201);
  await expect(page.getByRole('status')).toContainText('Invoice saved', { timeout: 10000 });
  await page.getByRole('button', { name: 'Sign out' }).click();
  await context.close();
  const fresh = await browser.newContext();
  const next = await fresh.newPage();
  await visit(next, '/app/invoices');
  await next.getByRole('button', { name: 'Owner login', exact: true }).first().click();
  await signInOwner(next, process.env.E2E_OWNER_PASSWORD!);
  await next.getByRole('textbox', { name: 'Search invoices' }).fill(number);
  await expect(next.locator('tbody tr')).toHaveCount(1);
  await expect(next.locator('tbody')).toContainText('$42.50');
  const snapshot = await (await fresh.request.get('/api/snapshot')).json();
  const invoice = snapshot.invoices.find((i: { number: string }) => i.number === number);
  expect(invoice).toBeTruthy();
  expect(
    snapshot.memories.every(
      (m: { status: string; blobId: string | null }) => m.status !== 'confirmed' || !!m.blobId,
    ),
  ).toBe(true);
  await fresh.request.delete(`/api/invoices/${invoice.id}`, { headers: { origin }, data: {} });
  await fresh.close();
});
