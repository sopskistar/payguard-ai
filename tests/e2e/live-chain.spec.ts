import { test, expect } from '@playwright/test';
const origin = process.env.E2E_BASE_URL || 'http://localhost:3000';
test('LIVE Tatum transaction inspector rejects an unrelated sample payment', async ({
  browser,
}) => {
  test.skip(
    process.env.LIVE_CHAIN_TEST !== '1' ||
      !process.env.E2E_OWNER_PASSWORD ||
      !process.env.TATUM_TEST_DIGEST,
    'Requires private owner access and an explicit real public digest. Read-only chain calls.',
  );
  test.setTimeout(120000);
  const context = await browser.newContext();
  expect(
    (
      await context.request.post('/api/auth/login', {
        headers: { origin },
        data: { password: process.env.E2E_OWNER_PASSWORD },
      })
    ).ok(),
  ).toBe(true);
  const page = await context.newPage();
  await page.goto('/app/wallets');
  await page.getByLabel('Transaction digest').fill(process.env.TATUM_TEST_DIGEST!);
  const inspected = page.waitForResponse((r) => r.url().endsWith('/api/transactions/inspect'), {
    timeout: 45000,
  });
  await page.getByRole('button', { name: 'Inspect transaction', exact: true }).click();
  expect((await inspected).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Chain evidence', exact: true })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.locator('.transaction-data')).toContainText(process.env.TATUM_TEST_DIGEST!);
  const snapshot = await (await context.request.get('/api/snapshot')).json();
  const invoice = snapshot.invoices.find(
    (i: { number: string; isDemo: boolean }) => i.isDemo && i.number === 'NS-1048',
  );
  expect(invoice).toBeTruthy();
  await page.goto('/app/review');
  await page.getByLabel('Invoice to review').selectOption(invoice.id);
  await page.getByLabel('Transaction digest').fill(process.env.TATUM_TEST_DIGEST!);
  const verified = page.waitForResponse((r) => r.url().endsWith('/api/payments/verify'), {
    timeout: 45000,
  });
  await page.getByRole('button', { name: 'Verify payment', exact: true }).click();
  const response = await verified;
  expect(response.status()).toBe(200);
  const result = await response.json();
  expect(result.status).toBe('Mismatch');
  await expect(page.locator('.result-heading')).toContainText('Mismatch', { timeout: 15000 });
  expect(result.receivedAtomic).toBe('0');
  await context.close();
});
