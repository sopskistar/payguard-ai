import { test, expect } from '@playwright/test';
test('judge finishes the account-free evidence journey on desktop and mobile', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/try');
  await expect(page.getByRole('heading', { name: /A familiar invoice/ })).toBeVisible();
  await page.getByRole('button', { name: 'Open supplier reference' }).click();
  await expect(page.getByText('PROPOSED RECIPIENT', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Check approval protection' }).click();
  await page.getByRole('button', { name: 'Try approving this invoice' }).click();
  await expect(page.getByText(/Blocked by the same approvalGate/)).toBeVisible();
  await page.getByRole('button', { name: 'Use the independent channel' }).click();
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('status')).toContainText('human attested');
  await page.getByRole('button', { name: 'Edit instructions after verification' }).click();
  await expect(page.getByRole('status')).toContainText('Complete out-of-band');
  await page.getByRole('button', { name: 'Compare memory OFF / ON' }).click();
  await page.getByRole('button', { name: 'Memory ON', exact: true }).click();
  await expect(page.getByText('Actual recalled Mainnet blob').first()).toBeVisible();
  await page.getByRole('button', { name: 'Inspect real Tatum evidence' }).click();
  await expect(page.getByText('Mismatch', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Record the final review' }).click();
  await page.getByRole('button', { name: 'Record review decision' }).click();
  await expect(page.getByRole('status')).toContainText('Approval blocked');
  await page.getByRole('button', { name: 'Reset practice' }).click();
  await expect(page.getByRole('button', { name: 'Open supplier reference' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const title of [
    /1\s*Open the invoice/,
    /4\s*Verify independently/,
    /5\s*Recall the policy/,
    /6\s*Inspect the chain/,
    /7\s*Audit the decision/,
  ]) {
    await page.getByRole('button', { name: title, exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  expect(errors).toEqual([]);
});
test('public users cannot quote, approve or settle service fees', async ({ request }) => {
  for (const path of [
    '',
    '/a0000000-0000-4000-8000-000000000001/approve',
    '/a0000000-0000-4000-8000-000000000001',
  ])
    expect(
      (
        await request.post('/api/service-payments' + path, {
          headers: { origin: process.env.E2E_BASE_URL || 'http://localhost:3000' },
          data: { approved: true },
        })
      ).status(),
    ).toBe(401);
});
