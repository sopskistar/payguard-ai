import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const preview = JSON.parse(await readFile('.data/sui-self-deposit/preview.json', 'utf8'));
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
});
const report = {
  checkedAt: new Date().toISOString(),
  browser: browser.version(),
  mode: 'local-unsigned-review',
  cases: [],
  fundedSigningTested: false,
};
try {
  for (const width of [1280, 360, 390, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    await page.goto('http://localhost:4318');
    await page.getByRole('button', { name: 'Copy Wallet A address', exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('#copy').disabled);
    const body = await page.textContent('body');
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    if (
      !fits ||
      !body.includes(preview.plan.payer) ||
      !body.includes('0.005000000') ||
      errors.length
    )
      throw new Error('Review rendering failed ' + JSON.stringify(errors));
    const sign = page.getByRole('button', { name: /Sign conversion/ });
    if (!(await sign.isDisabled())) throw new Error('Signing available unexpectedly');
    report.cases.push({
      name: 'review layout',
      width,
      zoom: '100%',
      addressVisible: true,
      noOverflow: fits,
      signDisabled: true,
      errors,
    });
    if ([1280, 390].includes(width)) {
      await mkdir('docs/screenshots/self-deposit', { recursive: true });
      await page.screenshot({
        path: `docs/screenshots/self-deposit/unsigned-${width}.png`,
        fullPage: true,
        mask: [page.locator('#terms dd').nth(1)],
      });
    }
    await page.close();
  }
  for (const match of [true, false]) {
    const page = await browser.newPage();
    await page.addInitScript(
      ({ address }) => {
        window.__walletCalls = { connect: 0, sign: 0, execute: 0 };
        const account = {
          address,
          publicKey: new Uint8Array(32),
          chains: ['sui:mainnet'],
          features: ['sui:signTransaction', 'sui:signAndExecuteTransaction'],
        };
        const wallet = {
          version: '1.0.0',
          name: 'Slush',
          id: 'com.mystenlabs.suiwallet',
          icon: 'data:image/png;base64,AA==',
          chains: ['sui:mainnet'],
          accounts: [account],
          features: {
            'standard:connect': {
              version: '1.0.0',
              connect: async () => {
                window.__walletCalls.connect++;
                return { accounts: [account] };
              },
            },
            'standard:events': { version: '1.0.0', on: () => () => {} },
            'sui:signTransaction': {
              version: '2.0.0',
              signTransaction: async () => {
                window.__walletCalls.sign++;
                throw Error('Must not sign');
              },
            },
            'sui:signAndExecuteTransaction': {
              version: '2.0.0',
              signAndExecuteTransaction: async () => {
                window.__walletCalls.execute++;
                throw Error('Must not execute');
              },
            },
          },
        };
        window.addEventListener('wallet-standard:app-ready', (event) =>
          event.detail.register(wallet),
        );
        window.dispatchEvent(
          new CustomEvent('wallet-standard:register-wallet', {
            detail: ({ register }) => register(wallet),
          }),
        );
      },
      { address: match ? preview.plan.payer : '0x' + 'b'.repeat(64) },
    );
    await page.goto('http://localhost:4318');
    await page.waitForFunction(() => !document.querySelector('#discover').disabled);
    await page.getByRole('button', { name: 'Find Slush extension', exact: true }).click();
    await page.getByRole('button', { name: /Connect existing Slush account/ }).click();
    await page.waitForFunction(
      () =>
        document.querySelector('#connection').textContent.includes('matches exactly') ||
        document.querySelector('#connection').textContent.includes('not the configured'),
    );
    const text = await page.locator('#connection').textContent();
    const calls = await page.evaluate(() => window.__walletCalls);
    if (
      calls.connect !== 1 ||
      calls.sign ||
      calls.execute ||
      !text.includes(match ? 'matches exactly' : 'not the configured')
    )
      throw new Error('Connection guard failed');
    report.cases.push({
      name: match ? 'matching Wallet A fixture' : 'different wallet rejected fixture',
      ...calls,
      physicalSlush: false,
    });
    await page.close();
  }
  const request = await browser.newContext();
  const denied = await request.request.post('http://localhost:4318/execute', {
    headers: { origin: 'http://localhost:4318' },
  });
  const remote = await request.request.get('http://localhost:4318/preview.json', {
    headers: { origin: 'https://example.com' },
  });
  const host = await request.request.get('http://localhost:4318/preview.json', {
    headers: { host: 'example.com' },
  });
  if (denied.status() !== 405 || remote.status() !== 403 || host.status() !== 403)
    throw new Error('Loopback safety guard failed');
  report.cases.push({
    name: 'no execution endpoint / foreign origin and host blocked',
    post: denied.status(),
    foreignOrigin: remote.status(),
    foreignHost: host.status(),
  });
  report.ok = true;
} catch (error) {
  report.ok = false;
  report.error = error.message;
} finally {
  await browser.close();
}
await writeFile('docs/evidence/self-deposit-browser.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.ok ? 0 : 1;
