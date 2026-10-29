import { test, expect, type Page } from '@playwright/test';
const transportFailures = new Map<Page, { method: string; path: string; error: string }[]>();
test.afterEach(async ({}, info) => {
  if (info.status !== info.expectedStatus) {
    const failures = [...transportFailures.values()].flat();
    if (failures.length)
      await info.attach('transport-failures', {
        body: JSON.stringify(failures),
        contentType: 'application/json',
      });
  }
  transportFailures.clear();
});

// Retry only a browser transport reset during a read-only navigation. Application errors still fail.
export async function visit(page: Page, url: string, options?: Parameters<Page['goto']>[1]) {
  if (!transportFailures.has(page)) {
    const failures: { method: string; path: string; error: string }[] = [];
    transportFailures.set(page, failures);
    page.on('requestfailed', (request) => {
      const error = request.failure()?.errorText || '';
      failures.push({
        method: request.method(),
        path: new URL(request.url()).pathname.replace(/[0-9a-f-]{36}/gi, '[id]'),
        error: /net::[A-Z_]+/.exec(error)?.[0] || 'transport failure',
      });
    });
  }
  try {
    return await page.goto(url, options);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('ERR_NETWORK_CHANGED')) throw error;
    test.info().annotations.push({
      type: 'transport-retry',
      description: 'One read-only navigation retried after browser ERR_NETWORK_CHANGED.',
    });
    // Stop the failed navigation before Chrome's delayed error page can interrupt recovery.
    const session = await page.context().newCDPSession(page);
    try {
      await session.send('Page.stopLoading');
    } finally {
      await session.detach();
    }
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
