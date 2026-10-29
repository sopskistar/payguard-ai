import { test, expect } from '@playwright/test';
import { visit } from './browser-helpers';
test('hosted wallet pause is visible and both signature endpoints fail closed', async ({
  page,
  request,
}) => {
  const status = await request.get('/api/auth/wallet/status');
  expect(status.status()).toBe(200);
  const { allowed } = await status.json();
  test.skip(
    allowed,
    'Security pause applies to hosted origins; local wallet fixtures are enabled.',
  );
  await visit(page, '/connect');
  await expect(
    page.getByRole('heading', { name: 'Wallet security review in progress' }),
  ).toBeVisible();
  await expect(page.getByText(/Do not override wallet warnings/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect Wallet' })).toHaveCount(0);
  const origin = new URL(page.url()).origin;
  for (const [path, data] of [
    ['challenge', { address: '0x' + '1'.repeat(64) }],
    [
      'verify',
      {
        id: 'a0000000-0000-4000-8000-000000000001',
        address: '0x' + '1'.repeat(64),
        signature: 'a'.repeat(88),
      },
    ],
  ] as const) {
    const r = await request.post('/api/auth/wallet/' + path, { headers: { origin }, data });
    expect(r.status()).toBe(503);
    expect((await r.json()).code).toBe('WALLET_SECURITY_REVIEW');
  }
  await page.getByRole('link', { name: 'Try without a wallet', exact: true }).click();
  await expect(page).toHaveURL(/\/try$/);
});
