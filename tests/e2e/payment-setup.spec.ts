import { test, expect } from '@playwright/test';
import { visit, registerBrowserDiagnostics } from './browser-helpers';
registerBrowserDiagnostics();
const payer = '0x' + '1'.repeat(64),
  recipient = '0x' + '2'.repeat(64);
const setup = {
  payer,
  recipient,
  partiesValid: true,
  variables: [{ name: 'ENABLE_AGENT_PAYMENTS', status: 'Quotes disabled' }],
  controlVerification: 'Incomplete: no wallet signature requested.',
  network: 'sui:mainnet',
  quoteEnabled: false,
  settlementEnabled: false,
  securityCleared: false,
  check: { state: 'unchecked' },
};
test('private setup distinguishes unusable coins, usable funds, security pause and failed checks (fixtures, no settlement)', async ({
  page,
  request,
}) => {
  expect((await request.get('/api/service-payments/setup')).status()).toBe(401);
  expect((await request.get('/api/service-payments/setup-check')).status()).toBe(401);
  const snapshot = await (await request.get('/api/snapshot')).json();
  await page.route('**/api/snapshot', (r) => r.fulfill({ json: { ...snapshot, mode: 'owner' } }));
  await page.route('**/api/service-payments', (r) =>
    r.fulfill({
      json: {
        configured: false,
        network: 'sui:mainnet',
        signingAllowed: false,
        securityCleared: false,
        dedicatedPayer: payer,
        intents: [],
      },
    }),
  );
  await page.route('**/api/service-payments/setup', (r) => r.fulfill({ json: setup }));
  let addressAtomic = '0';
  let unavailable = false;
  await page.route('**/api/service-payments/setup-check', (r) =>
    r.fulfill({
      json: {
        ...setup,
        check: unavailable
          ? { state: 'failed', message: 'Provider unavailable; balances unknown' }
          : {
              state: 'passed',
              preflight: {
                checkedAt: '2026-10-30T12:00:00.000Z',
                configurationReady: true,
                sufficientlyFunded: addressAtomic === '1000000',
                readyForExactApproval: false,
                sponsor: '0x' + '3'.repeat(64),
                chain: {
                  checkpoint: '123',
                  balances: {
                    payer: {
                      totalAtomic: (BigInt(addressAtomic) + 4000000n).toString(),
                      coinAtomic: '4000000',
                      addressAtomic,
                    },
                    recipient: null,
                  },
                },
              },
            },
      },
    }),
  );
  await visit(page, '/services#payment-setup');
  const panel = page.locator('#payment-setup');
  await expect(panel).toContainText('Ready for non-spending preflight');
  await panel.getByRole('button', { name: /Refresh balances/ }).click();
  await expect(panel).toContainText('Configured but insufficient usable funds');
  await expect(panel).toContainText('Conversion required');
  addressAtomic = '1000000';
  await panel.getByRole('button', { name: /Refresh balances/ }).click();
  await expect(panel).toContainText(
    'Configured and sufficiently funded; security clearance still required',
  );
  await expect(panel).toContainText('Saved settled records: 0');
  await panel.getByText('Funding your existing payer account', { exact: true }).click();
  await panel.getByRole('checkbox', { name: /I compared the complete payer address/ }).check();
  await expect(panel.getByRole('img', { name: /QR containing/ })).toBeVisible();
  await panel.getByRole('checkbox', { name: /I compared the complete payer address/ }).uncheck();
  await expect(panel.getByRole('img', { name: /QR containing/ })).toHaveCount(0);
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      JSON.stringify({
        width,
        overflow: await page.evaluate(() =>
          Array.from(document.querySelectorAll('main *'))
            .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
            .slice(0, 8)
            .map((e) => ({
              tag: e.tagName,
              className: String(e.className),
              right: e.getBoundingClientRect().right,
            })),
        ),
      }),
    ).toBe(true);
  }
  unavailable = true;
  await panel.getByRole('button', { name: /Refresh balances/ }).click();
  await expect(panel).toContainText('Failed or uncertain: provider check unavailable');
  await expect(panel).toContainText('Balance unknown');
  await expect(page.getByRole('button', { name: /Approve.*sign/i })).toHaveCount(0);
});
test('mobile navigation closes, traps focus, locks scroll and supports direct/back navigation', async ({
  page,
}) => {
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await visit(page, '/app/review');
    const open = page.getByRole('button', { name: 'Open navigation', exact: true });
    await open.click();
    const dialog = page.getByRole('dialog', { name: 'Workspace navigation' });
    const close = dialog.getByRole('button', { name: 'Close navigation', exact: true });
    await expect(close).toBeVisible();
    await expect(close).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: 'Owner login', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(open).toBeFocused();
    await expect(page.locator('.sidebar')).toHaveAttribute('aria-hidden', 'true');
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
    await open.click();
    await page
      .getByRole('button', { name: 'Dismiss navigation backdrop' })
      .click({ position: { x: width - 10, y: 400 } });
    await expect(open).toHaveAttribute('aria-expanded', 'false');
    await open.click();
    await dialog.getByRole('link', { name: 'Vendor Trust', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/vendors$/);
    await expect(open).toHaveAttribute('aria-expanded', 'false');
    await page.getByRole('button', { name: '← Back', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/review$/);
    await page.locator('.breadcrumb').getByRole('link', { name: 'Overview', exact: true }).click();
    await expect(page).toHaveURL(/\/app$/);
  }
});
