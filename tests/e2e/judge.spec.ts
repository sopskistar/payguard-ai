import { visit } from './browser-helpers';
import { test, expect } from '@playwright/test';
test('judge completes all seven clear steps, with back navigation, real evidence and no account', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await visit(page, '/try');
  await expect(page.getByRole('heading', { name: /Follow the invoice/ })).toBeVisible();
  const next = page.getByRole('button', { name: 'Next Step', exact: true });
  await next.click();
  await expect(page.getByText('PROPOSED RECIPIENT', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Meet the invoice', exact: true })).toBeVisible();
  await next.click();
  await next.click();
  await page.getByRole('button', { name: 'Try approving this invoice' }).click();
  await expect(page.getByRole('status')).toContainText('Approval blocked');
  await next.click();
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('status')).toContainText('human attested');
  await page.getByRole('button', { name: 'Test a 31-day-old confirmation' }).click();
  await expect(page.getByRole('status')).toContainText('Complete out-of-band');
  await page.getByRole('button', { name: 'Use current confirmation' }).click();
  await page.getByRole('button', { name: 'Edit instructions after verification' }).click();
  await expect(page.getByRole('status')).toContainText('Complete out-of-band');
  await next.click();
  await page.getByRole('button', { name: 'Memory ON', exact: true }).click();
  await page.getByText('Inspect the actual recalled policies & receipts', { exact: true }).click();
  await expect(page.getByText('Actual recalled Mainnet blob').first()).toBeVisible();
  await next.click();
  await expect(page.getByText('Mismatch', { exact: true })).toBeVisible();
  await next.click();
  await expect(page.getByRole('button', { name: 'Finish walkthrough' })).toBeDisabled();
  await page.getByRole('button', { name: 'Record review decision' }).click();
  await expect(page.getByRole('status')).toContainText('Approval blocked');
  await page.getByRole('button', { name: 'Finish walkthrough' }).click();
  await expect(page.getByText('Walkthrough complete.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start again' }).click();
  await expect(page.getByRole('heading', { name: 'Meet the invoice', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  for (let i = 0; i < 7; i++) {
    await expect(page.locator('#journey-step-title')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (i < 6) await next.click();
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
