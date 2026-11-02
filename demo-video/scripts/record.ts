/** Public-only capture. No app secrets, private cookies, DB imports or wallet actions. */
import { chromium, type Page, type Locator } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = 'https://payguard-ai-henna.vercel.app';
const out = root + '/recordings';
await mkdir(out, { recursive: true });
const release = await fetch(base + '/api/release', {
  headers: { 'Cache-Control': 'no-cache' },
}).then((r) => r.json());
const expected = process.env.DEMO_PRODUCTION_SHA;
if (expected && release.commit !== expected) throw Error('Requested release is not deployed');
type CaptureRecord = {
  id: string;
  scene: number;
  seconds: number;
  route: string;
  zoom?: number;
  path: string;
  offset: number;
  camera: { cx: number; cy: number };
  blockedRequests: string[];
};
const prior = await readFile(out + '/capture-manifest.json', 'utf8')
  .then(JSON.parse)
  .catch(() => null);
const manifest: {
  productionCommit: string;
  capturedAt: string;
  viewport: object;
  requestGuardVersion: number;
  safety: object;
  pieces: CaptureRecord[];
} = {
  productionCommit: release.commit,
  requestGuardVersion: 2,
  capturedAt: new Date().toISOString(),
  viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
  safety: {
    cleanContexts: true,
    extensions: false,
    walletConnections: 0,
    signatures: 0,
    payments: 0,
    memoryWrites: 0,
    databaseAccess: false,
  },
  pieces:
    prior?.productionCommit === release.commit && prior?.requestGuardVersion === 2
      ? prior.pieces
      : [],
};
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
    '/home/sopski/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
});
async function move(p: Page, l: Locator) {
  await l.scrollIntoViewIfNeeded();
  const b = await l.boundingBox();
  if (!b) throw Error('Required public UI target missing');
  await p.mouse.move(b.x + b.width / 2, b.y + Math.min(28, b.height / 2), { steps: 24 });
  await p.waitForTimeout(650);
}
async function click(p: Page, l: Locator) {
  await move(p, l);
  await l.click();
  await p.waitForTimeout(750);
}
async function next(p: Page, n: number) {
  for (let i = 0; i < n; i++)
    await click(p, p.getByRole('button', { name: 'Next Step', exact: true }));
}
async function focus(p: Page, l: Locator) {
  await l.scrollIntoViewIfNeeded();
  await p.waitForTimeout(700);
  const b = await l.boundingBox();
  if (!b) throw Error('Missing focus target');
  return {
    cx: Math.max(480, Math.min(1440, b.x + b.width / 2)),
    cy: Math.max(270, Math.min(810, b.y + Math.min(b.height / 2, 300))),
  };
}
type Piece = {
  id: string;
  scene: number;
  seconds: number;
  route: string;
  zoom?: number;
  setup: (p: Page) => Promise<{ cx: number; cy: number } | void>;
  act?: (p: Page) => Promise<void>;
};
const pieces: Piece[] = [
  {
    id: '01-hero',
    scene: 0,
    seconds: 2,
    route: '/',
    zoom: 1,
    setup: async (p) => {
      await p.getByRole('heading', { level: 1 }).waitFor();
    },
  },
  {
    id: '01-hook',
    scene: 0,
    seconds: 10,
    route: '/',
    zoom: 1.45,
    setup: async (p) => focus(p, p.locator('#problem')),
    act: async (p) => {
      await move(p, p.locator('#problem blockquote'));
    },
  },
  {
    id: '02-recipient',
    scene: 1,
    seconds: 6,
    route: '/try',
    zoom: 1.45,
    setup: async (p) => {
      await next(p, 1);
      return focus(p, p.locator('.journey-stage'));
    },
  },
  {
    id: '02-fbi',
    scene: 1,
    seconds: 7,
    route: '/',
    zoom: 1.4,
    setup: async (p) => focus(p, p.locator('#problem .site-problem-context')),
  },
  {
    id: '02-process',
    scene: 1,
    seconds: 9,
    route: '/',
    zoom: 1.35,
    setup: async (p) => focus(p, p.locator('#how-it-works')),
  },
  {
    id: '03-product',
    scene: 2,
    seconds: 24,
    route: '/try',
    zoom: 1.35,
    setup: async (p) => focus(p, p.locator('.journey-stage')),
    act: async (p) => {
      await p.waitForTimeout(1800);
      await next(p, 1);
      await p.waitForTimeout(2000);
      await next(p, 1);
      await click(p, p.getByRole('button', { name: 'Try approving this invoice' }));
      await p.waitForTimeout(2400);
      await next(p, 1);
      await p.waitForTimeout(1200);
      await click(p, p.getByRole('checkbox'));
      await p.waitForTimeout(1000);
    },
  },
  {
    id: '04-timeline',
    scene: 3,
    seconds: 3,
    route: '/courtroom',
    zoom: 1.35,
    setup: async (p) => focus(p, p.locator('.courtroom-learning')),
  },
  {
    id: '04-count',
    scene: 3,
    seconds: 3,
    route: '/proof#memory',
    zoom: 1.4,
    setup: async (p) => focus(p, p.locator('#memory').getByRole('heading', { level: 2 }).first()),
  },
  {
    id: '04-compare',
    scene: 3,
    seconds: 13,
    route: '/courtroom',
    zoom: 1.4,
    setup: async (p) => focus(p, p.locator('.courtroom-comparison')),
    act: async (p) => {
      await click(p, p.getByRole('button', { name: 'Memory OFF', exact: true }));
      await p.waitForTimeout(2200);
      await click(p, p.getByRole('button', { name: 'Memory ON', exact: true }));
      await click(p, p.getByRole('button', { name: 'Side by side', exact: true }));
      await p.waitForTimeout(2000);
    },
  },
  {
    id: '04-citation',
    scene: 3,
    seconds: 7,
    route: '/courtroom',
    zoom: 1.9,
    setup: async (p) => {
      const box = p.getByLabel('Memory ON review');
      await click(p, box.getByText('Inspect rule provenance and citations (7)', { exact: true }));
      return focus(p, box.locator('.courtroom-citation').first());
    },
  },
  {
    id: '05-attack',
    scene: 4,
    seconds: 10,
    route: '/courtroom',
    zoom: 1.45,
    setup: async (p) => focus(p, p.locator('.courtroom-console')),
    act: async (p) => {
      await click(p, p.getByRole('button', { name: 'Replay invoice attack', exact: true }));
      await move(p, p.locator('.courtroom-invoice'));
      await p.waitForTimeout(2000);
      await move(p, p.locator('.courtroom-comparison'));
      await p.waitForTimeout(1000);
    },
  },
  {
    id: '06-flow',
    scene: 5,
    seconds: 6,
    route: '/proof#payments',
    zoom: 1.35,
    setup: async (p) => focus(p, p.locator('.payment-evidence-flow')),
  },
  // This neutral editorial document excerpt is built from public reconciliation only.
  {
    id: '06-quote',
    scene: 5,
    seconds: 9,
    route: 'editorial:quote',
    zoom: 1,
    setup: async () => {},
  },
  {
    id: '06-three',
    scene: 5,
    seconds: 10,
    route: '/proof#payments',
    zoom: 1.4,
    setup: async (p) => focus(p, p.locator('.payment-evidence-grid')),
  },
  {
    id: '06-report',
    scene: 5,
    seconds: 13,
    route: '/proof#payments',
    zoom: 1.9,
    setup: async (p) => {
      await click(
        p,
        p.getByText('Inspect quote, settlement and delivered report', { exact: true }).first(),
      );
      return focus(
        p,
        p
          .locator('.payment-evidence-grid article')
          .first()
          .getByText('Delivered result:', { exact: false })
          .first(),
      );
    },
  },
  {
    id: '07-demo',
    scene: 6,
    seconds: 4,
    route: '/try',
    zoom: 1.25,
    setup: async (p) => focus(p, p.getByRole('heading', { name: /Follow the invoice/ })),
  },
  {
    id: '07-courtroom',
    scene: 6,
    seconds: 4,
    route: '/courtroom',
    zoom: 1.2,
    setup: async (p) => focus(p, p.locator('.courtroom-hero')),
  },
  {
    id: '07-connect',
    scene: 6,
    seconds: 4,
    route: '/connect',
    zoom: 1.2,
    setup: async (p) => {
      await p.getByRole('button', { name: 'Connect Wallet', exact: true }).waitFor();
      return focus(p, p.getByRole('heading', { name: 'Connect Sui Wallet', exact: true }));
    },
  },
  {
    id: '07-readme',
    scene: 6,
    seconds: 5,
    route: 'https://github.com/sopskistar/payguard-ai',
    zoom: 1.3,
    setup: async (p) =>
      focus(
        p,
        p.getByRole('heading', { name: 'HOW TO TEST PAYGUARD VERIFY', exact: true }).first(),
      ),
  },
  {
    id: '07-article',
    scene: 6,
    seconds: 5,
    route: 'https://sopskistar.github.io/payguard-ai/',
    zoom: 1.25,
    setup: async (p) => focus(p, p.getByRole('heading', { level: 1 }).first()),
  },
  {
    id: '08-close',
    scene: 7,
    seconds: 11,
    route: 'editorial:close',
    zoom: 1,
    setup: async () => {},
  },
];
const allowedPaths = new Set([
  '/',
  '/try',
  '/courtroom',
  '/proof',
  '/connect',
  '/api/release',
  '/api/auth/wallet/status',
]);
const publicProof = JSON.parse(
  await readFile(resolve(root, '../docs/evidence/mainnet-service-reconciliation.json'), 'utf8'),
);
const brandFont = (
  await readFile(
    resolve(root, '../node_modules/@fontsource/manrope/files/manrope-latin-700-normal.woff2'),
  )
).toString('base64');
const icon = (await readFile(resolve(root, '../public/brand/icon.png'))).toString('base64');
function editorial(kind: string) {
  const p = publicProof.payments[0];
  const body =
    kind === 'close'
      ? `<img width="146" height="146" src="data:image/png;base64,${icon}"><h1>PayGuard <span>Verify</span></h1><h2>Verify before you pay.</h2><h3>Remember what nearly went wrong.</h3><div class="links">payguard-ai-henna.vercel.app<br>github.com/sopskistar/payguard-ai<br>sopskistar.github.io/payguard-ai</div><footer>Decision support · Human accountability · Not a fraud-prevention guarantee</footer>`
      : `<small>RECORDED EVIDENCE EXCERPT · ORIGINAL PURCHASE 1</small><h1>HTTP 402 → exact approval → settlement</h1><pre>${JSON.stringify(
          {
            x402Version: p.challenge.x402Version,
            scheme: p.challenge.accepts[0].scheme,
            network: p.network,
            amountMIST: p.challenge.accepts[0].amount,
            asset: p.challenge.accepts[0].asset,
            merchant: p.merchant,
            gasSponsor: p.sponsor,
            quote: p.quoteId,
            approvedAt: p.approvedAt,
            exactApprovedBytesExecuted: p.exactApprovedBytesExecuted,
            settlementRequests: p.settlementRequests,
            executedDigest: p.digest,
            merchantCreditMIST: p.merchantCreditAtomic,
          },
          null,
          2,
        )}</pre><p>Synthetic invoice · Developer-controlled payer and merchant</p><footer>Source: public docs/evidence/mainnet-service-reconciliation.json · Not a new payment</footer>`;
  return `<!doctype html><html><head><style>@font-face{font-family:Manrope;src:url(data:font/woff2;base64,${brandFont}) format('woff2');font-weight:700}*{box-sizing:border-box}body{margin:0;width:1920px;height:1080px;background:#0d2833;color:#eaf7f7;font-family:Manrope,Arial,sans-serif;text-align:center;padding:94px 120px;overflow:hidden}h1{font-size:66px;margin:12px 0 35px}h1 span{color:#9cebd6}h2{font-size:52px;margin:18px 0}h3{font-size:36px;font-weight:400;color:#9cebd6;margin:12px 0}.links{font-size:30px;line-height:1.65;margin-top:42px}small{font-size:24px;color:#9cebd6}pre{font:24px/1.38 monospace;text-align:left;max-width:1460px;margin:30px auto;background:#061b25;padding:28px;border:1px solid #355b65;border-radius:12px}p{font-size:25px}footer{position:absolute;bottom:145px;left:0;width:100%;font-size:21px;color:#afcbd2}</style></head><body>${body}</body></html>`;
}
try {
  for (const piece of pieces) {
    if (manifest.pieces.some((p) => p.id === piece.id)) continue;
    const ctx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      colorScheme: 'dark',
      reducedMotion: 'no-preference',
      recordVideo: { dir: out + '/' + piece.id, size: { width: 1920, height: 1080 } },
    });
    const blocked: string[] = [];
    await ctx.route('**/*', async (route) => {
      const r = route.request(),
        u = new URL(r.url());
      if (
        !['GET', 'HEAD', 'OPTIONS'].includes(r.method()) ||
        (u.origin === base && /^\/(app|services)(\/|$)/.test(u.pathname)) ||
        (u.origin === base && u.pathname.startsWith('/api/') && !allowedPaths.has(u.pathname)) ||
        (u.origin === base &&
          r.isNavigationRequest() &&
          !allowedPaths.has(u.pathname) &&
          !u.pathname.startsWith('/_next/'))
      ) {
        blocked.push(r.method() + ' ' + u.pathname);
        await route.abort('blockedbyclient');
        return;
      }
      await route.continue();
    });
    const start = Date.now(),
      page = await ctx.newPage(),
      video = page.video()!;
    const loadDiagnostics: string[] = [];
    page.on('pageerror', (e) => loadDiagnostics.push('pageerror: ' + String(e).slice(0, 350)));
    page.on('requestfailed', (r) => {
      if (r.failure()?.errorText !== 'net::ERR_BLOCKED_BY_CLIENT')
        loadDiagnostics.push(new URL(r.url()).pathname + ': ' + r.failure()?.errorText);
    });
    if (piece.route.startsWith('editorial:'))
      await page.setContent(editorial(piece.route.split(':')[1]));
    else {
      const url = piece.route.startsWith('https:') ? piece.route : base + piece.route;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch (e) {
        if (!String(e).includes('ERR_NETWORK_CHANGED') && !String(e).includes('Timeout')) throw e;
        await page.waitForTimeout(350);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      }
    }
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1000);
    if (!piece.route.startsWith('https:') && !piece.route.startsWith('editorial:')) {
      const styled = () => {
        const h = document.querySelector('h1');
        const hero = document.querySelector('.site-hero');
        return (
          !!h &&
          parseFloat(getComputedStyle(h).fontSize) >= 28 &&
          (!hero || getComputedStyle(hero).display === 'grid')
        );
      };
      try {
        await page.waitForFunction(styled, undefined, { timeout: 20000 });
      } catch {
        console.log('One pre-interaction public GET reload after an incomplete stylesheet load.');
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForFunction(styled, undefined, { timeout: 20000 });
      }
      await page.evaluate(() => document.fonts.ready);
    }
    if (piece.route === '/try') {
      // Only a read-only, pre-interaction page reload may recover a stalled public chunk load.
      // Never force disabled controls or retry an application action.
      try {
        await page.getByRole('button', { name: 'Next Step', exact: true }).waitFor();
        await page.waitForFunction(
          () =>
            [...document.querySelectorAll('button')].some(
              (b) => b.textContent?.trim() === 'Next Step' && !b.disabled,
            ),
          undefined,
          { timeout: 20000 },
        );
      } catch {
        console.log('One read-only public /try reload before recording; no UI action retried.');
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForFunction(
          () =>
            [...document.querySelectorAll('button')].some(
              (b) => b.textContent?.trim() === 'Next Step' && !b.disabled,
            ),
          undefined,
          { timeout: 20000 },
        );
      }
    }
    if (await page.getByText('We couldn’t open this view.', { exact: true }).count())
      throw Error('Public page recovery screen; no invalid footage accepted');
    // Editorial cursor visualization only. No content, warning or browser security is changed.
    if (!piece.route.startsWith('editorial:'))
      await page.evaluate(() => {
        const c = document.createElement('div');
        c.id = 'demo-cursor';
        c.setAttribute('aria-hidden', 'true');
        c.style.cssText =
          'position:fixed;width:12px;height:12px;border:2px solid #c8fff0;background:#0d292d;border-radius:50%;box-shadow:0 0 0 2px #061722;z-index:2147483647;pointer-events:none;left:85%;top:90%';
        document.body.append(c);
        document.addEventListener('mousemove', (e) => {
          c.style.left = e.clientX - 6 + 'px';
          c.style.top = e.clientY - 6 + 'px';
        });
      });
    let camera;
    try {
      camera = (await piece.setup(page)) || { cx: 960, cy: 540 };
    } catch (error) {
      await page.screenshot({ path: out + '/' + piece.id + '-failed.png' });
      await writeFile(
        out + '/' + piece.id + '-failed.json',
        JSON.stringify(
          {
            url: page.url(),
            headings: await page.locator('h1,h2').allTextContents(),
            loadDiagnostics,
            body: (await page.locator('body').innerText()).slice(0, 800),
          },
          null,
          2,
        ),
      );
      throw error;
    }
    await page.waitForTimeout(800);
    const offset = (Date.now() - start) / 1000,
      begin = Date.now();
    await page.screenshot({ path: out + '/' + piece.id + '-source.png' });
    console.log('Recording public ' + piece.id);
    if (piece.act) await piece.act(page);
    else await page.mouse.move(camera.cx + 16, camera.cy + 8, { steps: 28 });
    const remaining = piece.seconds * 1000 - (Date.now() - begin) + 1500;
    if (remaining > 0) await page.waitForTimeout(remaining);
    await ctx.close();
    if (blocked.some((s) => /auth|service-payments|memory|invoice|vendor/i.test(s)))
      throw Error('Recording guard blocked a forbidden action: ' + blocked.join(', '));
    manifest.pieces.push({
      id: piece.id,
      scene: piece.scene,
      seconds: piece.seconds,
      route: piece.route,
      zoom: piece.zoom,
      path: await video.path(),
      offset,
      camera,
      blockedRequests: blocked,
    });
    manifest.pieces.sort(
      (a, b) => pieces.findIndex((p) => p.id === a.id) - pieces.findIndex((p) => p.id === b.id),
    );
    await writeFile(out + '/capture-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  }
} finally {
  await browser.close();
}
