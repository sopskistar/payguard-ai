import { test, expect } from '@playwright/test';
import { registerBrowserDiagnostics, visit } from './browser-helpers';
registerBrowserDiagnostics();
test('product story has six usable stages, play/pause/replay and no private operations', async ({
  page,
}) => {
  const mutations: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/') && r.method() !== 'GET')
      mutations.push(new URL(r.url()).pathname);
  });
  await visit(page, '/');
  const story = page.getByRole('region', { name: 'Interactive payment review illustration' });
  await expect(story).toContainText('Synthetic illustration');
  await expect(story.getByRole('heading')).toHaveText('An ordinary invoice');
  const stages = story.getByRole('list', { name: 'Product story steps' }).getByRole('button');
  await expect(stages).toHaveCount(6);
  await stages.nth(1).click();
  await expect(story.locator('.proposed code')).toContainText('0x2222');
  await stages.nth(2).click();
  await expect(story).toContainText('CHANGED RECIPIENT');
  await stages.nth(3).click();
  await expect(story.locator('.story-decision')).toContainText('Approval held');
  await stages.nth(4).click();
  await expect(story).toContainText('Practice human verification recorded');
  await stages.nth(5).click();
  await expect(story).toContainText('Later review · remembered procedure');
  await expect(stages.nth(5)).toHaveAttribute('aria-current', 'step');
  await story.getByRole('button', { name: 'Replay', exact: true }).click();
  await expect(story.getByRole('heading')).toHaveText('An ordinary invoice');
  await story.getByRole('button', { name: 'Play product story' }).click();
  await expect(story.getByRole('button', { name: 'Pause product story' })).toBeVisible();
  await expect(story.getByRole('heading')).toHaveText('One important difference', {
    timeout: 6000,
  });
  await story.getByRole('button', { name: 'Pause product story' }).click();
  await expect(story.getByRole('button', { name: 'Play product story' })).toBeVisible();
  // Keyboard activation must work without a pointer or financial wallet.
  await stages.nth(3).focus();
  await page.keyboard.press('Enter');
  await expect(story.locator('.story-decision')).toContainText('Approval held');
  expect(mutations).toEqual([]);
});
test('reduced-motion and mobile story preserve readable controls and clear access paths', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await visit(page, '/');
  const story = page.getByRole('region', { name: 'Interactive payment review illustration' });
  await expect(story).toContainText('Reduced motion');
  await expect(story.getByRole('button', { name: 'Play product story' })).toBeVisible();
  await story.getByRole('button', { name: /6 Recall the correction/ }).click();
  await expect(story.getByRole('heading')).toHaveText('The next review remembers why');
  expect(
    await page.evaluate(() => ({
      fits: document.documentElement.scrollWidth <= innerWidth,
      zoom: visualViewport?.scale,
    })),
  ).toEqual({ fits: true, zoom: 1 });
  await expect(page.getByText('FREE WALLET ACCOUNT', { exact: true })).toBeVisible();
  await expect(page.locator('#access')).toContainText('Connection alone does not authenticate');
  await expect(
    page.locator('.site-hero-actions').getByRole('link', { name: 'Connect Sui Wallet' }),
  ).toHaveAttribute('href', '/connect');
  await page.getByRole('button', { name: 'Memory ON', exact: true }).click();
  await expect(page.locator('.site-learning-result')).toContainText('Approval held in both modes');
  await expect(page.locator('.site-citation code')).not.toBeEmpty();
  await expect(page.locator('.site-recorded-note')).toContainText('no live provider calls');
  expect(errors).toEqual([]);
});
