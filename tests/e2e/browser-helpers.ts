import { test, expect, type Page } from '@playwright/test';

// Retry only a browser transport reset during a read-only navigation. Application errors still fail.
export async function visit(page: Page, url: string, options?: Parameters<Page['goto']>[1]) {
  try {
    return await page.goto(url, options);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('ERR_NETWORK_CHANGED')) throw error;
    test.info().annotations.push({
      type: 'transport-retry',
      description: 'One read-only navigation retried after browser ERR_NETWORK_CHANGED.',
    });
    await page.goto('about:blank');
    return page.goto(url, options);
  }
}
export async function signInOwner(page: Page, password: string) {
  const signedIn = page.waitForResponse(
    (r) => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST',
    { timeout: 30000 },
  );
  const snapshot = page.waitForResponse(
    async (r) => {
      if (!r.url().endsWith('/api/snapshot') || r.status() !== 200) return false;
      try {
        return (await r.json()).mode === 'owner';
      } catch {
        return false;
      }
    },
    { timeout: 30000 },
  );
  await page.getByLabel('Owner password').fill(password);
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  expect((await signedIn).status()).toBe(200);
  await snapshot;
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible({ timeout: 15000 });
}
