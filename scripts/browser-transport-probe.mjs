// Real public reads only. No request interception, credential entry, wallet or video.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const http1 = process.argv.includes('--http1');
const browser = await chromium.launch({
  args: http1 ? ['--disable-http2'] : [],
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
    '/home/sopski/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell',
});
const report = {
  checkedAt: new Date().toISOString(),
  http2Disabled: http1,
  isolation: 'One sequential command; no concurrent subprocesses or recovery retries',
  pages: [],
  credentialsUsed: false,
  video: false,
};
try {
  for (const path of ['/', '/try', '/app', '/app/replay', '/proof']) {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const failures = [];
    page.on('requestfailed', (r) =>
      failures.push({
        path: new URL(r.url()).pathname,
        code: /net::[A-Z_]+/.exec(r.failure()?.errorText || '')?.[0] || 'transport failure',
      }),
    );
    try {
      const response = await page.goto('https://payguard-ai-henna.vercel.app' + path, {
        timeout: 15000,
      });
      if (path === '/try')
        await page.locator('.journey-ready-controls:not([disabled])').waitFor({ timeout: 10000 });
      if (path.startsWith('/app'))
        await page.getByText('Public demo', { exact: true }).waitFor({ timeout: 10000 });
      report.pages.push({ path, status: response?.status(), ready: true, failures });
    } catch (e) {
      report.pages.push({
        path,
        ready: false,
        category: /ERR_NETWORK_CHANGED|chrome-error/.test(e.message)
          ? 'browser transport'
          : 'navigation/readiness failure',
        failures,
      });
    }
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(
  http1 ? '.data/browser-transport-http1.json' : '.data/browser-transport-probe.json',
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));
process.exit(report.pages.every((p) => p.ready && p.status === 200 && !p.failures.length) ? 0 : 2);
