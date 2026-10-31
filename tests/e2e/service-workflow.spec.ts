import { test, expect, type BrowserContext } from '@playwright/test';
import { registerBrowserDiagnostics, visit } from './browser-helpers';
import { GrpcTypes } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import { toBase64 } from '@mysten/sui/utils';
import { serviceConfiguration } from '../../src/lib/service-setup';
import {
  decodeServicePaymentHeader,
  serviceTermsSchema,
  validateServiceTransaction,
  MAINNET_GENESIS,
} from '../../src/lib/service-protocol';
registerBrowserDiagnostics();
const origin = process.env.E2E_BASE_URL || 'http://localhost:3000';
const payer = '0x' + '1'.repeat(64),
  merchant = '0x' + '2'.repeat(64),
  sponsor = '0x' + '3'.repeat(64);
const quotedId = 'd0000000-0000-4000-8000-000000000001',
  paidId = 'd0000000-0000-4000-8000-000000000002';
let context: BrowserContext, invoiceId: string;
test.describe('isolated service UI contracts; all financial and memory responses are fixtures', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeAll(async ({ browser }) => {
    test.skip(
      !process.env.E2E_OWNER_PASSWORD ||
        !['localhost', '127.0.0.1'].includes(new URL(origin).hostname),
      'Requires isolated local owner workspace; never run financial UI fixtures on Production.',
    );
    context = await browser.newContext();
    const r = await context.request.post('/api/auth/login', {
      headers: { origin },
      data: { password: process.env.E2E_OWNER_PASSWORD },
    });
    expect(r.status()).toBe(200);
    const snapshot = await (await context.request.get('/api/snapshot')).json();
    invoiceId = snapshot.invoices.find((v: { number: string }) => v.number === 'NS-1048').id;
  });
  test.afterAll(async () => {
    if (context) {
      await context.request.post('/api/auth/logout', { headers: { origin }, data: {} });
      await context.close();
    }
  });
  async function pageFixture(signing = false, preparation = signing, rejectSignature = false) {
    const page = await context.newPage();
    await page.addInitScript(() =>
      localStorage.removeItem('payguard:service-sign-attempt:d0000000-0000-4000-8000-000000000001'),
    );
    const calls = { quote: 0, remember: 0, approve: 0, settle: 0 };
    const challenge = (id: string) => ({
      x402Version: 2,
      resource: {
        url: origin + '/api/service-payments/' + id,
        description: 'Synthetic first-party report fixture',
        mimeType: 'application/json',
      },
      accepts: [
        {
          scheme: 'exact',
          network: 'sui:mainnet',
          asset: '0x2::sui::SUI',
          amount: '1000000',
          payTo: merchant,
          maxTimeoutSeconds: 300,
          extra: {
            gasOwner: sponsor,
            gasBudget: '2000000',
            quoteId: id,
            instructionHash: 'a'.repeat(64),
          },
        },
      ],
    });
    const expiresAt = new Date(Date.now() + 300000).toISOString();
    await page.route('**/api/service-payments/setup', (route) =>
      route.fulfill({
        json: {
          ...serviceConfiguration({
            SERVICE_PAYMENT_PAYER: payer,
            SERVICE_PAYMENT_RECIPIENT: merchant,
            ENABLE_AGENT_PAYMENTS: 'mainnet',
            SERVICE_PAYMENT_SETTLEMENT_ENABLED: signing ? 'true' : 'false',
          }),
          network: 'sui:mainnet',
          quoteEnabled: true,
          securityCleared: preparation,
          settlementEnabled: signing,
          check: {
            state: 'unchecked',
            preflight: null,
            diagnostics: [],
            checkedAt: null,
            message: 'Synthetic configuration fixture; no provider call',
          },
        },
      }),
    );
    await page.route('**/api/service-payments', async (route) => {
      if (route.request().method() === 'GET')
        return route.fulfill({
          json: {
            configured: true,
            signingAllowed: signing,
            preparationAllowed: preparation,
            securityCleared: signing,
            network: 'sui:mainnet',
            dedicatedPayer: payer,
            intents: [
              { id: paidId, invoiceId, challenge: challenge(paidId), state: 'settled', expiresAt },
              {
                id: quotedId,
                invoiceId,
                challenge: challenge(quotedId),
                state: 'quoted',
                expiresAt,
              },
            ],
          },
        });
      calls.quote++;
      return route.fulfill({
        status: 402,
        headers: {
          'PAYMENT-REQUIRED': Buffer.from(JSON.stringify(challenge(quotedId))).toString('base64'),
        },
        json: { id: quotedId, expiresAt, ...challenge(quotedId) },
      });
    });
    await page.route('**/api/service-payments/*/*', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/events')) return route.fulfill({ json: { recorded: true } });
      if (path.endsWith('/approve')) {
        calls.approve++;
        if (!preparation) throw Error('Fixture unexpectedly attempted approval');
        const input = route.request().postDataJSON();
        expect(input.approved).toBe(true);
        expect(input.payer).toBe(payer);
        validateServiceTransaction(
          input.transaction,
          serviceTermsSchema.parse(challenge(quotedId).accepts[0]),
          payer,
        );
        return route.fulfill({ json: { approved: true } });
      }
      if (path.endsWith('/remember')) {
        calls.remember++;
        expect(route.request().postDataJSON()).toEqual({ consent: true });
        return route.fulfill({ json: { status: 'confirmed', blobId: 'SYNTHETIC_MEMWAL_FIXTURE' } });
      }
      if (path.includes(paidId) && path.endsWith('/resume'))
        return route.fulfill({
          json: {
            state: 'settled',
            receipt: {
              id: 'synthetic-receipt',
              digest: 'SYNTHETIC_PAID_ANALYSIS_FIXTURE',
              result: { provider: 'First-party analysis fixture', supplierApprovalUnchanged: true },
            },
          },
        });
      if (path.includes(quotedId) && path.endsWith('/resume'))
        return route.fulfill({ json: { state: 'quoted' } });
      return route.fallback();
    });
    await page.route('**/api/service-payments/*', async (route) => {
      if (route.request().method() === 'POST' && route.request().headers()['payment-signature']) {
        calls.settle++;
        if (!signing) return route.abort('blockedbyclient');
        const payload = decodeServicePaymentHeader(route.request().headers()['payment-signature']);
        validateServiceTransaction(
          payload.payload.transaction,
          serviceTermsSchema.parse(challenge(quotedId).accepts[0]),
          payer,
        );
        return route.fulfill({
          json: {
            state: 'settled',
            receipt: {
              id: 'SYNTHETIC_OWNER_FLOW',
              digest: 'SYNTHETIC_OWNER_FLOW',
              result: { supplierApprovalUnchanged: true },
            },
          },
        });
      }
      return route.fallback();
    });
    if (preparation) {
      const frame = (bytes: Uint8Array) => {
        const message = Buffer.alloc(5 + bytes.length);
        message.writeUInt32BE(bytes.length, 1);
        Buffer.from(bytes).copy(message, 5);
        const trailer = Buffer.from('grpc-status: 0\r\n');
        const end = Buffer.alloc(5 + trailer.length);
        end[0] = 128;
        end.writeUInt32BE(trailer.length, 1);
        trailer.copy(end, 5);
        return Buffer.concat([message, end]);
      };
      await page.route('https://fullnode.mainnet.sui.io/**', async (route) => {
        const headers = {
          'content-type': 'application/grpc-web+proto',
          'access-control-allow-origin': origin,
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': '*',
          'access-control-expose-headers': 'grpc-status, grpc-message',
          'grpc-status': '0',
        };
        if (route.request().method() === 'OPTIONS')
          return route.fulfill({ status: 200, headers, body: '' });
        const method = new URL(route.request().url()).pathname.split('/').pop();
        let bytes: Uint8Array;
        if (method === 'GetEpoch')
          bytes = GrpcTypes.GetEpochResponse.toBinary(
            GrpcTypes.GetEpochResponse.create({
              epoch: {
                epoch: 1296n,
                referenceGasPrice: 100n,
                systemState: { epoch: 1296n, referenceGasPrice: 100n, epochStartTimestampMs: 1n },
              },
            }),
          );
        else if (method === 'GetServiceInfo')
          bytes = GrpcTypes.GetServiceInfoResponse.toBinary(
            GrpcTypes.GetServiceInfoResponse.create({ chain: 'mainnet', chainId: MAINNET_GENESIS }),
          );
        else if (method === 'GetBalance')
          bytes = GrpcTypes.GetBalanceResponse.toBinary(
            GrpcTypes.GetBalanceResponse.create({
              balance: {
                coinType: '0x2::sui::SUI',
                balance: 10000000n,
                coinBalance: 5000000n,
                addressBalance: 5000000n,
              },
            }),
          );
        else throw new Error('Unexpected RPC in fully mocked signing fixture: ' + method);
        return route.fulfill({ status: 200, headers, body: frame(bytes) });
      });
      await page.exposeBinding('signServiceFixture', async (_, json: string) => {
        const bytes = toBase64(await Transaction.from(json).build());
        validateServiceTransaction(
          bytes,
          serviceTermsSchema.parse(challenge(quotedId).accepts[0]),
          payer,
        );
        return { bytes, signature: 'Zml4dHVyZQ==' }; // Deliberately not a real signature.
      });
      await page.addInitScript(
        ({ payer, rejectSignature }) => {
          const stats = { sign: 0, execute: 0 };
          Object.assign(window, { serviceFixtureStats: stats });
          const account = {
            address: payer,
            publicKey: new Uint8Array(32),
            chains: ['sui:mainnet'],
            features: ['sui:signTransaction'],
          };
          const wallet = {
            version: '1.0.0',
            id: 'payguard-service-fixture',
            name: 'PayGuard Service Fixture',
            icon: 'data:image/png;base64,AA==',
            chains: ['sui:mainnet'],
            accounts: [account],
            features: {
              'standard:connect': {
                version: '1.0.0',
                connect: async () => ({ accounts: [account] }),
              },
              'standard:events': { version: '1.0.0', on: () => () => {} },
              'sui:signTransaction': {
                version: '2.0.0',
                signTransaction: async (input: {
                  transaction: { toJSON: () => Promise<string> };
                  account: { address: string };
                  chain: string;
                }) => {
                  stats.sign++;
                  if (rejectSignature)
                    throw Object.assign(new Error('User rejected the transaction in Slush.'), {
                      code: 4001,
                    });
                  if (input.chain !== 'sui:mainnet' || input.account.address !== payer)
                    throw new Error('Wrong fixture signer');
                  return (
                    window as unknown as {
                      signServiceFixture: (
                        json: string,
                      ) => Promise<{ bytes: string; signature: string }>;
                    }
                  ).signServiceFixture(await input.transaction.toJSON());
                },
              },
              'sui:signAndExecuteTransaction': {
                version: '2.0.0',
                signAndExecuteTransaction: async () => {
                  stats.execute++;
                  throw new Error('No Sign-and-Execute fallback allowed');
                },
              },
            },
          };
          window.addEventListener('wallet-standard:app-ready', ((event: CustomEvent) =>
            event.detail.register(wallet)) as EventListener);
          window.dispatchEvent(
            new CustomEvent('wallet-standard:register-wallet', {
              detail: ({ register }: { register: (w: unknown) => void }) => register(wallet),
            }),
          );
        },
        { payer, rejectSignature },
      );
    }
    await visit(page, '/services');
    await expect(
      page.getByRole('button', { name: 'Request payment quote', exact: true }),
    ).toBeEnabled();
    return {
      page,
      calls,
      enableSigning: () => {
        signing = true;
      },
    };
  }
  test('validates a 402 quote, enforces the signing pause and expires without opening a wallet', async () => {
    const { page, calls } = await pageFixture();
    await page.clock.install();
    await page.getByRole('button', { name: 'Request payment quote', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Payment required · x402 v2' })).toBeVisible();
    await expect(page.locator('[aria-label="Selected invoice details"]')).toContainText(invoiceId);
    const approve = page.getByRole('button', {
      name: 'Review 0.001 SUI purchase · prepare',
      exact: true,
    });
    await expect(approve).toBeDisabled();
    await page.getByRole('checkbox').last().check();
    await expect(approve).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Use existing Slush web wallet', exact: true }),
    ).toHaveCount(0);
    for (const width of [360, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.clock.fastForward(301000);
    await expect(page.getByText(/This quote has expired/)).toBeVisible();
    expect(calls).toEqual({ quote: 1, remember: 0, approve: 0, settle: 0 });
    // The serial tests share a context/session; do not leak the advanced clock.
    await page.clock.setSystemTime(new Date());
    await page.close();
  });
  test('does not attribute a saved paid report to a different unpaid intent', async () => {
    const { page, calls } = await pageFixture();
    await page.getByRole('button', { name: /Resume saved settled intent/ }).click();
    await expect(page.getByText('Tatum-confirmed service receipt', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Resume saved quoted intent/ }).click();
    await expect(page.getByText('Tatum-confirmed service receipt', { exact: true })).toHaveCount(0);
    await expect(page.getByText('SYNTHETIC_PAID_ANALYSIS_FIXTURE', { exact: false })).toHaveCount(
      0,
    );
    expect(calls.remember).toBe(0);
    await page.close();
  });
  test('requests the minimized Walrus rule only after its separate consent click', async () => {
    const { page, calls } = await pageFixture();
    await page.getByRole('button', { name: /Resume saved settled intent/ }).click();
    await expect(page.getByText(/Optional minimized learning for this vendor/)).toBeVisible();
    expect(calls.remember).toBe(0);
    await page
      .getByRole('button', { name: 'Consent to a minimized Walrus verification rule', exact: true })
      .click();
    await expect(
      page.getByText(/Walrus learning confirmed: SYNTHETIC_MEMWAL_FIXTURE/),
    ).toBeVisible();
    expect(calls.remember).toBe(1);
    expect(calls.settle).toBe(0);
    await page.close();
  });
  test('separates preparation and one wallet signature, then delivers an owned analysis receipt (fully mocked)', async () => {
    const { page, calls } = await pageFixture(true);
    await page.getByRole('button', { name: 'Request payment quote', exact: true }).click();
    await page.getByRole('checkbox').last().check();
    await page.getByLabel('Signing wallet').selectOption('payguard-service-fixture');
    await page
      .getByRole('button', {
        name: 'Review 0.001 SUI purchase · prepare',
        exact: true,
      })
      .click();
    const sign = page.getByRole('button', {
      name: 'Sign and submit in wallet',
      exact: true,
    });
    await expect(sign).toBeEnabled();
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { serviceFixtureStats: { sign: number } }).serviceFixtureStats.sign,
      ),
    ).toBe(0);
    expect(calls.approve).toBe(1);
    expect(calls.settle).toBe(0);
    await sign.click();
    await expect(page.getByText('Tatum-confirmed service receipt', { exact: true })).toBeVisible();
    expect(calls.settle).toBe(1);
    await expect(
      page.getByText('2 confirmed settled service purchases recorded; inspect the saved receipt', {
        exact: true,
      }),
    ).toBeVisible();
    expect(calls.remember).toBe(0);
    await expect(sign).toBeDisabled();
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { serviceFixtureStats: { sign: number; execute: number } })
            .serviceFixtureStats,
      ),
    ).toEqual({ sign: 1, execute: 0 });
    await page.close();
  });
  test('prepares exact approved bytes with settlement disabled and never opens signing (fully mocked)', async () => {
    const { page, calls, enableSigning } = await pageFixture(false, true);
    await page.getByRole('button', { name: 'Request payment quote', exact: true }).click();
    await page.getByRole('checkbox').last().check();
    await page.getByLabel('Signing wallet').selectOption('payguard-service-fixture');
    await page
      .getByRole('button', {
        name: 'Review 0.001 SUI purchase · prepare',
        exact: true,
      })
      .click();
    await expect(
      page.getByRole('button', { name: 'Sign and submit in wallet', exact: true }),
    ).toBeDisabled();
    const prepared = await page.locator('.service-prepared-digest').first().textContent();
    enableSigning();
    await page
      .getByRole('button', { name: 'Refresh payment controls · no signing', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Sign and submit in wallet', exact: true }),
    ).toBeEnabled();
    expect(await page.locator('.service-prepared-digest').first().textContent()).toBe(prepared);
    expect(calls.approve).toBe(1);
    expect(calls.settle).toBe(0);
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { serviceFixtureStats: { sign: number; execute: number } })
            .serviceFixtureStats,
      ),
    ).toEqual({ sign: 0, execute: 0 });
    await page.close();
  });
  test('shows the real wallet rejection without submission or an automatic retry (mock wallet)', async () => {
    const { page, calls } = await pageFixture(true, true, true);
    await page.getByRole('button', { name: 'Request payment quote', exact: true }).click();
    await page.getByRole('checkbox').last().check();
    await page.getByLabel('Signing wallet').selectOption('payguard-service-fixture');
    await page
      .getByRole('button', { name: 'Review 0.001 SUI purchase · prepare', exact: true })
      .click();
    const sign = page.getByRole('button', { name: 'Sign and submit in wallet', exact: true });
    await expect(sign).toBeEnabled();
    await sign.click();
    await expect(page.locator('.error-banner')).toContainText(
      '4001: User rejected the transaction in Slush.',
    );
    await expect(sign).toBeDisabled();
    expect(calls.settle).toBe(0);
    await expect(page.getByLabel('Payment status timeline')).toContainText(
      'No signed submission received',
    );
    await page.close();
  });
});
