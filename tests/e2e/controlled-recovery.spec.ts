import { test, expect, type BrowserContext } from '@playwright/test';
import {
  APPROVED_SERVICE_RECOVERIES,
  type ControlledRecoveryStatus,
} from '../../src/lib/approved-service-recoveries';
import { registerBrowserDiagnostics, visit } from './browser-helpers';
registerBrowserDiagnostics();
const origin = process.env.E2E_BASE_URL || 'http://localhost:3000';
let context: BrowserContext;
test.describe('controlled recovery interface; disposable workspace and mocked financial responses only', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeAll(async ({ browser }) => {
    test.skip(
      !process.env.E2E_OWNER_PASSWORD ||
        !['localhost', '127.0.0.1'].includes(new URL(origin).hostname),
      'Disposable local QA only; never run financial fixtures on Production.',
    );
    context = await browser.newContext();
    const login = await context.request.post(origin + '/api/auth/login', {
      headers: { origin },
      data: { password: process.env.E2E_OWNER_PASSWORD },
    });
    expect(login.status()).toBe(200);
  });
  test.afterAll(async () => {
    if (context) {
      await context.request.post(origin + '/api/auth/logout', { headers: { origin }, data: {} });
      await context.close();
    }
  });
  test('protects actual read-only status with workspace authentication and exposes the disabled runtime flag', async ({
    browser,
  }) => {
    const anonymous = await browser.newContext();
    expect((await anonymous.request.get(origin + '/api/service-payments/recovery')).status()).toBe(
      401,
    );
    await anonymous.close();
    const response = await context.request.get(origin + '/api/service-payments/recovery');
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ enabled: false, records: [], scope: null });
    expect(response.headers()['cache-control']).toContain('no-store');
  });
  async function fixture(mode: 'success' | 'timeout-committed' | 'discrepancy' = 'success') {
    const page = await context.newPage();
    const specs = APPROVED_SERVICE_RECOVERIES.filter((r) => r.role === 'member');
    const completed = new Set<string>(),
      writes: string[] = [];
    let enabled = true,
      failVerification = false,
      inspectionReads = 0;
    const status = (): ControlledRecoveryStatus => ({
      enabled,
      checkedAt: new Date().toISOString(),
      scope: 'member:' + specs[0].payer,
      verified: !failVerification,
      // A different administrator workspace still has its original hold.
      allOriginalsClosed: false,
      issues: failVerification ? ['WALLET_LIABILITY_CONFLICT'] : [],
      nextId: failVerification ? null : specs.find((s) => !completed.has(s.id))?.id || null,
      records: specs.map((s) => ({
        id: s.id,
        payer: s.payer,
        digest: s.digest,
        amountAtomic: s.amountAtomic,
        state: completed.has(s.id) ? 'expired-unexecuted' : 'approved',
        recoveredVerified: completed.has(s.id) && !failVerification,
        auditId: completed.has(s.id) ? 'DISPOSABLE_AUDIT_' + s.id : null,
        releasedAtomic: completed.has(s.id) ? s.amountAtomic : '0',
        issues: [],
      })),
      wallet: {
        reservedAtomic: String((3 - completed.size) * 1000000),
        liabilityAtomic: String((3 - completed.size) * 1000000),
      },
      sponsor: {
        reservedAtomic: String((3 - completed.size) * 1000000),
        liabilityAtomic: String((3 - completed.size) * 1000000),
      },
    });
    await page.route('**/api/auth/wallet/status', (r) =>
      r.fulfill({ json: { allowed: false, slushBlocked: true } }),
    );
    await page.route('**/api/snapshot', async (route) => {
      const snapshot = await (await route.fetch()).json();
      return route.fulfill({
        json: { ...snapshot, mode: 'member', identity: { walletAddress: specs[0].payer } },
      });
    });
    await page.route('**/api/service-payments', async (route) => {
      if (route.request().method() !== 'GET') {
        writes.push('UNEXPECTED');
        return route.abort();
      }
      const records = status().records;
      return route.fulfill({
        json: {
          configured: true,
          network: 'sui:mainnet',
          audience: 'customer',
          dedicatedPayer: specs[0].payer,
          signingAllowed: true,
          preparationAllowed: true,
          securityCleared: true,
          exposure: {
            reservedAtomic: String((3 - completed.size) * 1000000),
            capAtomic: '3000000',
          },
          recoveryHolds: records
            .filter((r) => r.state === 'approved')
            .map((r) => ({ id: r.id, digest: r.digest })),
          intents: records.map((r) => ({
            id: r.id,
            state: r.state,
            payer: r.payer,
            invoiceId: 'DISPOSABLE_INVOICE',
            expiresAt: '2026-11-03T00:00:00.000Z',
            challenge: {
              x402Version: 2,
              resource: {
                url: origin + '/api/service-payments/' + r.id,
                description: 'Disposable recovery fixture',
                mimeType: 'application/json',
              },
              accepts: [
                {
                  scheme: 'exact',
                  network: 'sui:mainnet',
                  asset: '0x2::sui::SUI',
                  amount: '1000000',
                  payTo: '0x' + '2'.repeat(64),
                  maxTimeoutSeconds: 300,
                  extra: {
                    quoteId: r.id,
                    instructionHash: 'a'.repeat(64),
                    gasOwner: '0x' + '3'.repeat(64),
                    gasBudget: '2000000',
                  },
                },
              ],
            },
          })),
        },
      });
    });
    await page.route('**/api/service-payments/recovery', (r) => {
      inspectionReads++;
      return r.fulfill({ json: status() });
    });
    await page.route('**/api/service-payments/*/recover-expired', async (route) => {
      const id = new URL(route.request().url()).pathname.split('/')[3];
      writes.push(id);
      expect(route.request().postDataJSON()).toEqual({ confirmRecovery: true });
      expect(specs.map((s) => s.id)).toContain(id);
      completed.add(id);
      if (mode === 'timeout-committed') return route.abort('timedout');
      if (mode === 'discrepancy') failVerification = true;
      return route.fulfill({
        json: {
          state: 'expired-unexecuted',
          recovered: true,
          releasedAtomic: '1000000',
          preparedDigest: specs.find((s) => s.id === id)!.digest,
        },
      });
    });
    await visit(page, origin + '/services');
    const panel = page.getByRole('region', { name: 'Historical payment recovery' });
    await expect(panel.getByText('Recovery window enabled')).toBeVisible();
    return {
      page,
      panel,
      specs,
      writes,
      reads: () => inspectionReads,
      setEnabled: (value: boolean) => {
        enabled = value;
      },
    };
  }
  test('requires each confirmation and independently reads audit/accounting before the next original; keeps checkout blocked until flag shutdown but does not inherit an administrator hold', async () => {
    const f = await fixture();
    await f.page.setViewportSize({ width: 390, height: 900 });
    const button = f.panel.getByRole('button', { name: 'Recover this original hold' });
    await expect(button).toBeDisabled();
    expect(
      await f.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true);
    for (const spec of f.specs) {
      const reads = f.reads();
      await f.panel.getByRole('checkbox').check();
      await button.click();
      await expect(
        f.panel.getByText('Recovery audit:').filter({ hasText: 'DISPOSABLE_AUDIT_' + spec.id }),
      ).toBeVisible();
      expect(f.reads()).toBeGreaterThanOrEqual(reads + 2);
      expect(f.writes.at(-1)).toBe(spec.id);
    }
    expect(f.writes).toEqual(f.specs.map((s) => s.id));
    await expect(
      f.page.getByRole('button', { name: 'Request payment quote', exact: true }),
    ).toBeDisabled();
    f.setEnabled(false);
    await f.panel.getByRole('button', { name: 'Refresh recovery status · read only' }).click();
    await expect(f.panel.getByText('Recovery window disabled')).toBeVisible();
    await expect(
      f.page.getByRole('button', { name: 'Request payment quote', exact: true }),
    ).toBeEnabled();
    await f.page.close();
  });
  test('an uncertain committed response never repeats or advances, including after reload, until the window is closed and status reconciled', async () => {
    const f = await fixture('timeout-committed');
    await f.panel.getByRole('checkbox').check();
    await f.panel.getByRole('button', { name: 'Recover this original hold' }).click();
    await expect(f.panel.getByRole('alert')).toContainText('STOP');
    await f.page.reload();
    await expect(f.panel.getByRole('alert')).toContainText(
      'previous recovery request needs review',
    );
    await expect(f.panel.getByRole('button', { name: 'Recover this original hold' })).toHaveCount(
      0,
    );
    await f.panel.getByRole('button', { name: 'Refresh recovery status · read only' }).click();
    expect(f.writes).toEqual([f.specs[0].id]);
    f.setEnabled(false);
    await f.panel.getByRole('button', { name: 'Refresh recovery status · read only' }).click();
    await expect(f.panel.getByText('Recovery window disabled')).toBeVisible();
    await expect(f.panel.getByRole('button', { name: 'Recover this original hold' })).toHaveCount(
      0,
    );
    expect(f.writes).toHaveLength(1);
    await f.page.close();
  });
  test('successful HTTP cannot advance when independent persisted accounting disagrees', async () => {
    const f = await fixture('discrepancy');
    await f.panel.getByRole('checkbox').check();
    await f.panel.getByRole('button', { name: 'Recover this original hold' }).click();
    await expect(f.panel.getByText(/WALLET_LIABILITY_CONFLICT/)).toBeVisible();
    await expect(f.panel.getByRole('button', { name: 'Recover this original hold' })).toHaveCount(
      0,
    );
    await f.panel.getByRole('button', { name: 'Refresh recovery status · read only' }).click();
    expect(f.writes).toEqual([f.specs[0].id]);
    await f.page.close();
  });
});
