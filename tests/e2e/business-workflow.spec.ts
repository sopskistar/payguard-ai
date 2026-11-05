import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { test, expect, type BrowserContext } from '@playwright/test';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { registerBrowserDiagnostics, visit } from './browser-helpers';
registerBrowserDiagnostics();
const origin = process.env.E2E_BASE_URL || 'http://localhost:3000';
let maker: BrowserContext,
  checker: BrowserContext,
  outsider: BrowserContext,
  organizationId: string,
  invoiceId: string,
  proposalId: string;
const makerKey = Ed25519Keypair.generate(),
  checkerKey = Ed25519Keypair.generate(),
  outsiderKey = Ed25519Keypair.generate();
const recipient = '0x' + 'a'.repeat(64),
  invoiceNumber = 'BUSINESS-E2E-01';
async function authenticate(context: BrowserContext, key: Ed25519Keypair) {
  const r = await context.request.post(origin + '/api/auth/wallet/challenge', {
    headers: { origin },
    data: { address: key.toSuiAddress() },
  });
  expect(r.status()).toBe(200);
  const c = await r.json(),
    signed = await key.signPersonalMessage(new TextEncoder().encode(c.message));
  const login = await context.request.post(origin + '/api/auth/wallet/verify', {
    headers: { origin },
    data: { id: c.id, address: key.toSuiAddress(), signature: signed.signature },
  });
  expect(login.status()).toBe(200);
}
async function post(context: BrowserContext, path: string, data: unknown) {
  return context.request.post(origin + '/api/business/' + path, { headers: { origin }, data });
}
test.describe('integrated business workflow; real local APIs with disposable identities and no live financial/provider writes', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeAll(async ({ browser }) => {
    test.skip(
      !['localhost', '127.0.0.1'].includes(new URL(origin).hostname),
      'Disposable local workflow only.',
    );
    maker = await browser.newContext();
    checker = await browser.newContext();
    outsider = await browser.newContext();
    await authenticate(maker, makerKey);
    await authenticate(checker, checkerKey);
    await authenticate(outsider, outsiderKey);
  });
  test.afterAll(async () => {
    await maker?.close();
    await checker?.close();
    await outsider?.close();
  });
  test('creates an explicitly shared business and assigns a different authenticated verifier', async () => {
    const page = await maker.newPage();
    await visit(page, origin + '/app/business');
    await page.getByLabel('Business name', { exact: true }).fill('Synthetic Workflow Business');
    await page.getByRole('checkbox', { name: /authorize sharing/ }).check();
    await page.getByRole('button', { name: 'Create business workspace', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Synthetic Workflow Business', exact: true }),
    ).toBeVisible();
    const list = await (await maker.request.get(origin + '/api/business')).json();
    organizationId = list[0].id;
    await page.getByText('Members and role management', { exact: true }).click();
    await page
      .getByLabel('Existing member wallet', { exact: true })
      .fill(checkerKey.toSuiAddress());
    await page.getByLabel('Business role', { exact: true }).selectOption('verifier');
    await page.getByRole('button', { name: 'Add or update authorized member' }).click();
    await expect(
      page.getByText('Membership saved. No email invitation was sent.', { exact: true }),
    ).toBeVisible();
    expect((await checker.request.get(origin + '/api/business/' + organizationId)).status()).toBe(
      200,
    );
    expect((await outsider.request.get(origin + '/api/business/' + organizationId)).status()).toBe(
      403,
    );
    await page.close();
  });
  test('uploads a real PDF, previews extracted source and requires correction review before saving', async () => {
    const page = await maker.newPage();
    await visit(page, origin + '/app/business');
    await page.getByRole('button', { name: 'Add or upload invoice', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const uploading = page.waitForResponse(
      (r) => r.url().endsWith('/extract') && r.request().method() === 'POST',
    );
    await dialog
      .getByLabel('Upload invoice', { exact: true })
      .setInputFiles('public/samples/northstar-invoice.pdf');
    const uploaded = await uploading;
    expect(uploaded.status()).toBe(200);
    const fingerprint = (await uploaded.json()).metadata;
    const originalBytes = await readFile('public/samples/northstar-invoice.pdf');
    expect(fingerprint.size).toBe(originalBytes.length);
    expect(fingerprint.sha256).toBe(createHash('sha256').update(originalBytes).digest('hex'));
    expect(fingerprint.sha256).not.toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    await expect(
      dialog.getByRole('heading', { name: 'Review the source before saving' }),
    ).toBeVisible({ timeout: 45000 });
    await expect(dialog.locator('img.document-preview')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save & review invoice' })).toBeDisabled();
    await dialog.getByLabel('Vendor / merchant').fill('Synthetic Workflow Supplier');
    await dialog.getByLabel('Invoice number').fill(invoiceNumber);
    await dialog.getByLabel('Issued date').fill('2026-11-05');
    await dialog.getByLabel('Due date').fill('2026-12-01');
    await dialog.getByLabel('Invoice amount').fill('1250.00');
    await dialog.getByRole('textbox', { name: /^Currency(?: |$)/ }).fill('USD');
    await dialog.getByLabel('Proposed payment destination', { exact: true }).fill(recipient);
    await dialog.getByRole('checkbox', { name: /reviewed the source/ }).check();
    await dialog.getByRole('button', { name: 'Save & review invoice' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.locator('.business-invoice').filter({ hasText: invoiceNumber }),
    ).toBeVisible();
    const snapshot = await (
      await maker.request.get(origin + '/api/business/' + organizationId)
    ).json();
    invoiceId = snapshot.invoices.find((i: { number: string }) => i.number === invoiceNumber).id;
    expect(snapshot.profiles).toHaveLength(0);
    expect(snapshot.documents[0].status).toBe('saved');
    await page.close();
  });
  test('requires a proposal and blocks self-approval through the real authenticated API', async () => {
    const r = await post(maker, organizationId + '/proposals', {
      invoiceId,
      operationKey: crypto.randomUUID(),
      note: 'Synthetic requester checked the document; a separate verifier must confirm the supplier.',
      initialProfile: {
        trustedRecipient: recipient,
        emailDomain: 'supplier.example',
        contactLabel: 'Synthetic established purchasing contact',
        contactMethod: 'phone',
        contactReference: 'SYN established callback 001',
        establishedAt: '2026-01-01T00:00:00Z',
        independentlySourced: true,
      },
    });
    expect(r.status()).toBe(201);
    proposalId = (await r.json()).id;
    const self = await post(maker, organizationId + '/proposals/' + proposalId + '/decision', {
      outcome: 'confirmed',
      method: 'phone',
      note: 'Synthetic attempted self approval must be refused.',
      evidenceReference: 'SYN callback 001',
      usedEstablishedContact: true,
    });
    expect(self.status()).toBe(403);
    expect((await self.json()).code).toBe('SELF_APPROVAL');
    const foreign = await post(
      outsider,
      organizationId + '/proposals/' + proposalId + '/decision',
      {},
    );
    expect(foreign.status()).toBe(403);
  });
  test('a separately signed-in verifier records evidence and the timeline shows the actual decision', async () => {
    const page = await checker.newPage();
    await visit(page, origin + '/app/business');
    await expect(
      page.getByRole('heading', { name: 'Verification requests', exact: true }),
    ).toBeVisible();
    await page
      .getByLabel('Independent verification outcome', { exact: true })
      .selectOption('confirmed');
    await page.getByLabel('Channel actually used', { exact: true }).selectOption('phone');
    await page
      .getByLabel('Evidence reference · private', { exact: true })
      .fill('SYN callback record E2E-01');
    await page
      .getByLabel('What you independently verified', { exact: true })
      .fill(
        'Synthetic separate-verifier fixture confirming this exact proposed reference. No real supplier callback is claimed.',
      );
    await page
      .getByRole('checkbox', { name: /used the independently established contact/ })
      .check();
    await page.getByRole('button', { name: 'Record independent decision', exact: true }).click();
    await expect(
      page.getByText('Independent decision recorded. It does not authorize a payment.', {
        exact: true,
      }),
    ).toBeVisible();
    const timeline = page.getByRole('region', { name: 'Supplier change timeline' });
    await expect(
      timeline.getByRole('heading', {
        name: 'Payment change approved by a distinct verifier',
        exact: true,
      }),
    ).toBeVisible();
    const snapshot = await (
      await checker.request.get(origin + '/api/business/' + organizationId)
    ).json();
    const change = snapshot.changes.find((p: { id: string }) => p.id === proposalId);
    expect(change.state).toBe('approved');
    expect(change.checkedBy).not.toBe(change.proposedBy);
    expect(snapshot.profiles[0].trustedRecipient).toBe(recipient);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: '.data/business-workflow-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: '.data/business-workflow-desktop.png', fullPage: true });
    await page.close();
  });
  test('material edits invalidate the prior approval and a revoked session cannot read or decide', async () => {
    const snapshot = await (
        await maker.request.get(origin + '/api/business/' + organizationId)
      ).json(),
      invoice = snapshot.invoices.find((i: { id: string }) => i.id === invoiceId);
    const edit = await maker.request.patch(
      origin + '/api/business/' + organizationId + '/invoices/' + invoiceId,
      {
        headers: { origin },
        data: {
          ...invoice,
          memo: 'A materially edited synthetic source invalidates the earlier decision.',
          importKey: crypto.randomUUID(),
        },
      },
    );
    expect(edit.status()).toBe(200);
    const next = await (await maker.request.get(origin + '/api/business/' + organizationId)).json();
    expect(next.changes.find((p: { id: string }) => p.id === proposalId).state).toBe('invalidated');
    expect(
      (
        await post(maker, organizationId + '/members', {
          wallet: checkerKey.toSuiAddress(),
          role: 'verifier',
          revoke: true,
        })
      ).status(),
    ).toBe(200);
    expect((await checker.request.get(origin + '/api/business/' + organizationId)).status()).toBe(
      403,
    );
    expect(
      (await post(checker, organizationId + '/proposals/' + proposalId + '/decision', {})).status(),
    ).toBe(403);
  });
  test('cross-tenant documents, content validation and unconfigured forwarding fail safely', async () => {
    const snapshot = await (
        await maker.request.get(origin + '/api/business/' + organizationId)
      ).json(),
      document = snapshot.documents[0];
    expect(
      (
        await outsider.request.get(
          origin + '/api/business/' + organizationId + '/documents/' + document.id,
        )
      ).status(),
    ).toBe(403);
    expect(
      (await outsider.request.get(origin + '/api/intake/documents/' + document.id)).status(),
    ).toBe(404);
    const invalid = await maker.request.post(
      origin + '/api/business/' + organizationId + '/extract',
      {
        headers: { origin },
        multipart: {
          file: {
            name: 'fake.png',
            mimeType: 'image/png',
            buffer: Buffer.from('<script>untrusted</script>'),
          },
        },
      },
    );
    expect(invalid.status()).toBe(415);
    const forwarding = await (
      await maker.request.get(origin + '/api/business/' + organizationId + '/forwarding')
    ).json();
    expect(forwarding.configuration.configured).toBe(false);
    expect(forwarding.route).toBeNull();
    expect((await maker.request.post(origin + '/api/intake/inbound', { data: {} })).status()).toBe(
      503,
    );
  });
  test('the built application performs real local image OCR and leaves extraction unapproved', async () => {
    const bytes = await readFile('tests/fixtures/synthetic-ocr-invoice.png');
    const response = await maker.request.post(
      origin + '/api/business/' + organizationId + '/extract',
      {
        headers: { origin },
        multipart: {
          file: { name: 'synthetic-ocr-invoice.png', mimeType: 'image/png', buffer: bytes },
        },
        timeout: 50000,
      },
    );
    expect(response.status(), await response.text()).toBe(200);
    const result = await response.json();
    expect(result.fields.vendor).toContain('Synthetic OCR Studio');
    expect(result.fields.amount).toBe('1250.00');
    expect(result.metadata.fields.amount.confidence).toBe('heuristic');
    expect(result.retained).toBe(false);
    const state = await (
      await maker.request.get(origin + '/api/business/' + organizationId)
    ).json();
    expect(state.documents.find((d: { id: string }) => d.id === result.documentId).status).toBe(
      'review',
    );
    expect(state.invoices).toHaveLength(1);
  });
  test('failed source processing is visible inside the review form and requires an explicit manual fallback', async () => {
    const page = await maker.newPage();
    await visit(page, origin + '/app/business');
    await page.getByRole('button', { name: 'Add or upload invoice', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Upload invoice', { exact: true }).setInputFiles({
      name: 'invalid.png',
      mimeType: 'image/png',
      buffer: Buffer.from('<svg>Not a PNG</svg>'),
    });
    await expect(dialog.getByRole('alert')).toContainText('The selected file was not processed.');
    await expect(dialog.getByRole('button', { name: 'Save & review invoice' })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Enter details manually', exact: true }).click();
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Save & review invoice' })).toBeEnabled();
    await page.close();
  });
});
