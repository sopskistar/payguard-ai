// Public pages only. No wallet connection, account, credentials, signing or video.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = 'https://payguard-ai-henna.vercel.app';
const dir = 'docs/screenshots/final-mainnet';
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
    '/home/sopski/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell',
  args: ['--disable-http2'],
});
const views = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.name));
    for (const [name, path] of [
      ['home', '/'],
      ['connect', '/connect'],
      ['judge', '/try'],
      ['proof', '/proof#payments'],
    ]) {
      const response = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 });
      if (response?.status() !== 200) throw Error(`Screenshot page unavailable: ${path}`);
      if (name === 'connect')
        await page.getByRole('button', { name: 'Connect Wallet', exact: true }).waitFor();
      const metrics = await page.evaluate(() => ({
        viewport: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        scale: visualViewport?.scale,
        cssZoom: getComputedStyle(document.documentElement).zoom,
        devicePixelRatio,
      }));
      if (metrics.documentWidth > width || metrics.scale !== 1 || metrics.devicePixelRatio !== 1)
        throw Error(`Overflow/zoom mismatch: ${name} ${width}`);
      const file = `${dir}/${name}-${width}.png`;
      await page.screenshot({ path: file, fullPage: name !== 'proof', animations: 'disabled' });
      views.push({ name, url: base + path, file, status: response.status(), ...metrics });
    }
    if (errors.length) throw Error('Browser runtime error during capture');
    await context.close();
  }
  const release = await (await fetch(base + '/api/release')).json();
  const report = {
    checkedAt: new Date().toISOString(),
    release,
    video: false,
    walletConnection: false,
    publicPagesOnly: true,
    views,
  };
  await writeFile(
    'docs/evidence/final-release-screenshots.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      commit: release.commit,
      screenshots: views.length,
      widths: [1440, 390],
      zoom: '100%',
      noOverflow: true,
    }),
  );
} finally {
  await browser.close();
}
