// Explicit public-page screenshots only. No wallet connection, private workspace or video.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = 'https://payguard-ai-henna.vercel.app';
const expected = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(expected || '')) throw Error('Supply the exact deployed Git SHA.');
const directory = 'docs/screenshots/hackathon-release';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
    '/home/sopski/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell',
  args: ['--disable-http2'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const release = await (await context.request.get(base + '/api/release')).json();
if (release.commit !== expected) throw Error('Deployment does not match requested source SHA.');
const report = {
  capturedAt: new Date().toISOString(),
  base,
  release,
  browser: 'Chromium',
  zoom: '100%',
  deviceScaleFactor: 1,
  reducedMotion: true,
  publicPagesOnly: true,
  video: false,
  checks: [],
  screenshots: [],
  consoleErrors: [],
};
let financialRequests = 0;
page.on('console', (message) => {
  if (message.type() === 'error') report.consoleErrors.push(message.text().slice(0, 300));
});
page.on('request', (request) => {
  if (
    request.method() === 'POST' &&
    new URL(request.url()).pathname.startsWith('/api/service-payments')
  )
    financialRequests++;
});
try {
  for (const [label, route] of [
    ['home', '/'],
    ['courtroom', '/courtroom'],
    ['proof', '/proof'],
    ['connect', '/connect'],
    ['judge', '/try'],
  ]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + route, { waitUntil: 'domcontentloaded' });
    await page.locator('h1').first().waitFor();
    if (route === '/connect')
      await page
        .getByText(/Connect Sui Wallet/i)
        .first()
        .waitFor({ timeout: 30000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    // Allow client initialization, bounded finite transitions and the provider list to settle.
    await page.waitForTimeout(1200);
    const file = `${directory}/${label}-desktop-1440.png`;
    await page.screenshot({ path: file, fullPage: true });
    report.screenshots.push({
      route,
      width: 1440,
      height: 1000,
      file,
      capturedAt: new Date().toISOString(),
    });
    for (const width of [360, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      const geometry = await page.evaluate(() => ({
        viewport: innerWidth,
        content: document.documentElement.scrollWidth,
        scale: visualViewport?.scale,
        zoom: getComputedStyle(document.documentElement).zoom,
      }));
      const passed =
        geometry.content <= geometry.viewport && geometry.scale === 1 && geometry.zoom === '1';
      report.checks.push({ route, width, ...geometry, passed });
      if (!passed) throw Error('Layout/zoom failed: ' + route + ' at ' + width);
      if (width === 390 || route === '/courtroom') {
        const file = `${directory}/${label}-mobile-${width}.png`;
        await page.screenshot({ path: file, fullPage: true });
        report.screenshots.push({
          route,
          width,
          height: 844,
          file,
          capturedAt: new Date().toISOString(),
        });
      }
    }
  }
  const article = await context.request.get('https://sopskistar.github.io/payguard-ai/');
  const html = await article.text();
  report.article = {
    url: article.url(),
    status: article.status(),
    updatedMarker: html.includes('courtroom-three-receipts'),
    linksCourtroom: html.includes('https://payguard-ai-henna.vercel.app/courtroom'),
    allThreeDigests: [
      '68bhHRKzrQang8xohsahBQbehoZ4SjApQJ1U1Wf2ppyx',
      'xASYnWVeftLraQ2RvxMR6oPndU3r7UoBrX9Z9KPJd9r',
      '4NxNL1sekFUNxpiu6ebhTtwdkT5UXnsiMsnhcPNK1tGA',
    ].every((digest) => html.includes(digest)),
  };
  if (
    article.status() !== 200 ||
    !report.article.updatedMarker ||
    !report.article.allThreeDigests ||
    !report.article.linksCourtroom
  )
    throw Error('Published article is not current.');
  const judge = await context.request.get('https://sopskistar.github.io/payguard-ai/try/');
  report.staticJudgeStatus = judge.status();
  report.financialRequests = financialRequests;
  if (financialRequests) throw Error('Unexpected public financial request.');
  if (judge.status() !== 200) throw Error('Published static judge artifact unavailable.');
  report.ok = true;
} catch (error) {
  report.ok = false;
  report.error = error.message;
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(directory + '/manifest.json', JSON.stringify(report, null, 2) + '\n');
}
console.log(
  JSON.stringify(
    {
      ok: report.ok,
      screenshots: report.screenshots.length,
      checks: report.checks,
      article: report.article,
      error: report.error,
    },
    null,
    2,
  ),
);
