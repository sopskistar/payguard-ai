import { test, expect, type Page, type Request } from '@playwright/test';
const transportFailures = new Map<Page, { method: string; path: string; error: string }[]>();
const pending = new Map<
  Page,
  Map<Request, { method: string; path: string; type: string; started: number }>
>();
const badResponses = new Map<Page, { path: string; status: number }[]>();
export function registerBrowserDiagnostics() {
  test.afterEach(async ({}, info) => {
    if (info.status !== info.expectedStatus) {
      const failures = [...transportFailures.values()].flat();
      const inFlight = [...pending.values()].flatMap((m) =>
        [...m.values()].map(({ started, ...r }) => ({ ...r, elapsedMs: Date.now() - started })),
      );
      const publicReadiness = [];
      for (const page of transportFailures.keys()) {
        if (page.isClosed() || !page.url().includes('/try')) continue;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          publicReadiness.push(
            await Promise.race([
              page.evaluate(() => ({
                documentReady: document.readyState,
                disabled:
                  document.querySelector<HTMLFieldSetElement>('.journey-ready-controls')?.disabled,
                scriptCount: document.scripts.length,
                flightQueue: !!(window as unknown as { __next_f?: unknown }).__next_f,
              })),
              new Promise((resolve) => {
                timer = setTimeout(
                  () => resolve({ unavailable: 'renderer diagnostic deadline' }),
                  1000,
                );
              }),
            ]),
          );
        } catch {
          publicReadiness.push({ unavailable: 'navigation changed execution context' });
        } finally {
          if (timer) clearTimeout(timer);
        }
      }
      if (failures.length || inFlight.length || publicReadiness.length)
        await info.attach('transport-failures', {
          body: JSON.stringify({
            failures,
            inFlight,
            badResponses: [...badResponses.values()].flat(),
            publicReadiness,
          }),
          contentType: 'application/json',
        });
    }
    transportFailures.clear();
    pending.clear();
    badResponses.clear();
  });
}

// Retry only a browser transport reset during a read-only navigation. Application errors still fail.
export async function visit(page: Page, url: string, options?: Parameters<Page['goto']>[1]) {
  if (!transportFailures.has(page)) {
    const failures: { method: string; path: string; error: string }[] = [];
    transportFailures.set(page, failures);
    const requests = new Map<
      Request,
      { method: string; path: string; type: string; started: number }
    >();
    const responses: { path: string; status: number }[] = [];
    pending.set(page, requests);
    badResponses.set(page, responses);
    const path = (url: string) => new URL(url).pathname.replace(/[0-9a-f-]{36}/gi, '[id]');
    page.on('request', (r) =>
      requests.set(r, {
        method: r.method(),
        path: path(r.url()),
        type: r.resourceType(),
        started: Date.now(),
      }),
    );
    page.on('requestfinished', (r) => requests.delete(r));
    page.on('response', (r) => {
      if (r.status() >= 400) responses.push({ path: path(r.url()), status: r.status() });
    });
    page.on('requestfailed', (request) => {
      requests.delete(request);
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
    // Retry the read directly. Error-page CDP targets may already have detached.
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
