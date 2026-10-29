import { registerBrowserDiagnostics } from './browser-helpers';
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
const origin = process.env.E2E_BASE_URL || 'http://localhost:3000';
registerBrowserDiagnostics();
test('LIVE Mainnet correction is recalled in a separate owner session', async ({ browser }) => {
  test.skip(
    process.env.LIVE_MEMORY_TEST !== '1' || !process.env.E2E_OWNER_PASSWORD,
    'Requires explicit LIVE_MEMORY_TEST=1, private owner access and configured Neon/Walrus. Creates a real memory unless LIVE_MEMORY_REUSE=1 uses the existing confirmed correction.',
  );
  test.setTimeout(240000);
  const first = await browser.newContext();
  const login = await first.request.post('/api/auth/login', {
    headers: { origin },
    data: { password: process.env.E2E_OWNER_PASSWORD },
  });
  expect(login.ok()).toBe(true);
  const snapshot = await (await first.request.get('/api/snapshot')).json();
  expect(snapshot.integrations.memory).toBe(true);
  const invoice = snapshot.invoices.find(
    (i: { isDemo: boolean; number: string }) => i.isDemo && i.number === 'NS-1048',
  );
  expect(invoice).toBeTruthy();
  const off = await first.request.post('/api/review', {
    headers: { origin },
    data: { invoiceId: invoice.id, memoryOn: false },
  });
  expect(off.ok()).toBe(true);
  let job: { id: string; status: string; blobId: string | null };
  if (process.env.LIVE_MEMORY_REUSE === '1') {
    job = snapshot.memories.find(
      (m: { status: string; invoiceId: string; intent: string }) =>
        m.status === 'confirmed' && m.invoiceId === invoice.id && m.intent === 'remember',
    );
    expect(job).toBeTruthy();
  } else {
    const correction = await first.request.post('/api/corrections', {
      headers: { origin },
      data: {
        invoiceId: invoice.id,
        findingId: 'recipient-change',
        action: 'remember',
        explanation:
          'Synthetic live demo: independently verify the supplier before any changed payout address is approved.',
        scope: 'vendor',
        future: true,
        kind: 'verify_address',
        value: '',
        hard: false,
        consent: true,
        operationKey: randomUUID(),
      },
    });
    expect(correction.ok()).toBe(true);
    job = await correction.json();
  }
  for (let attempt = 0; job.status === 'pending' && attempt < 4; attempt++) {
    const response = await first.request.post('/api/memory/resume', {
      headers: { origin },
      data: { id: job.id },
    });
    expect(response.ok()).toBe(true);
    job = await response.json();
  }
  expect(job.status).toBe('confirmed');
  expect(job.blobId).toBeTruthy();
  const next = await first.request.post('/api/demo/next', {
    headers: { origin },
    data: { invoiceId: invoice.id },
  });
  expect(next.ok()).toBe(true);
  const later = await next.json();
  await first.request.post('/api/auth/logout', { headers: { origin }, data: {} });
  await first.close();
  const second = await browser.newContext();
  expect(
    (
      await second.request.post('/api/auth/login', {
        headers: { origin },
        data: { password: process.env.E2E_OWNER_PASSWORD },
      })
    ).ok(),
  ).toBe(true);
  let learned: { citations: { blobId: string }[]; findings: { memoryId?: string }[] } = {
    citations: [],
    findings: [],
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await second.request.post('/api/review', {
      headers: { origin },
      data: { invoiceId: later.id, memoryOn: true },
    });
    expect(response.ok()).toBe(true);
    learned = await response.json();
    if (learned.citations.some((c) => c.blobId === job.blobId)) break;
  }
  expect(learned.citations.some((c) => c.blobId === job.blobId)).toBe(true);
  expect(learned.findings.some((f) => f.memoryId === job.id)).toBe(true);
  await second.close();
});
