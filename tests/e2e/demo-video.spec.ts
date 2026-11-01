import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import config from '../../src/content/demo-video.json' with { type: 'json' };
import { resolveDemoVideo } from '../../src/lib/demo-video';
import { visit, registerBrowserDiagnostics } from './browser-helpers';
registerBrowserDiagnostics();
let bundle: string, css: string, poster: string;
test.beforeAll(async () => {
  const compiled = await build({
    stdin: {
      contents: `import {createRoot} from 'react-dom/client';import {DemoVideoPlayer} from './src/components/demo-video';import {resolveDemoVideo} from './src/lib/demo-video';const video=location.pathname==='/pending'?null:resolveDemoVideo({approved:true,watchUrl:'https://youtu.be/TESTVIDEO01',title:'Controlled video fixture',captionLanguage:'en',transcriptUrl:'https://example.org/test-transcript'});createRoot(document.getElementById('root')).render(<DemoVideoPlayer video={video}/>);`,
      loader: 'tsx',
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    jsx: 'automatic',
    platform: 'browser',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  bundle = compiled.outputFiles[0].text;
  const styles = await readFile('src/app/globals.css', 'utf8');
  css = styles.slice(styles.indexOf('\n.demo-video {'));
  poster = await readFile('public/demo-poster.svg', 'utf8');
});
test('unfinished video stays absent from the three real public entry points', async ({ page }) => {
  const approved = resolveDemoVideo(config);
  for (const path of ['/', '/try', '/proof']) {
    await visit(page, path);
    await expect(page.locator('h1').first()).toBeVisible();
    const region = page.getByRole('region', { name: 'Official demo video', exact: true });
    if (!approved) {
      await expect(region).toHaveCount(0);
      await expect(page.locator('iframe')).toHaveCount(0);
    } else {
      await expect(region).toBeVisible();
      await expect(
        region.getByRole('link', { name: `Watch on ${approved.provider} ↗` }),
      ).toHaveAttribute('href', approved.watchUrl);
      await expect(region.locator('iframe')).toHaveCount(0);
    }
  }
});
test('controlled player fixture loads only on keyboard activation, retains captions/fallback and fits mobile', async ({
  page,
}) => {
  let providerRequests = 0;
  await page.route('http://video-fixture.test/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/app.js') return route.fulfill({ contentType: 'text/javascript', body: bundle });
    if (path === '/demo-poster.svg')
      return route.fulfill({ contentType: 'image/svg+xml', body: poster });
    return route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Controlled video fixture — no real footage</title><style>body{margin:0;background:#071722}${css}</style></head><body><main id="root"></main><script src="/app.js"></script></body></html>`,
    });
  });
  await page.route('https://www.youtube-nocookie.com/**', (route) => {
    providerRequests++;
    return route.fulfill({
      contentType: 'text/html',
      body: '<p>Video provider fixture. No real video was loaded.</p>',
    });
  });
  await page.goto('http://video-fixture.test/pending');
  await expect(page.getByRole('region', { name: 'Official demo video' })).toHaveCount(0);
  expect(providerRequests).toBe(0);
  await page.goto('http://video-fixture.test/approved');
  const preview = page.getByRole('button', { name: 'Load Controlled video fixture on YouTube' });
  await expect(preview).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(providerRequests).toBe(0);
  await preview.focus();
  await page.keyboard.press('Enter');
  const frame = page.locator('iframe');
  await expect(frame).toHaveAttribute('title', 'Controlled video fixture');
  await expect(frame).toHaveAttribute(
    'src',
    /youtube-nocookie\.com\/embed\/TESTVIDEO01\?.*cc_load_policy=1/,
  );
  await expect.poll(() => providerRequests).toBe(1);
  await expect(page.getByRole('link', { name: 'Watch on YouTube ↗' })).toHaveAttribute(
    'href',
    'https://www.youtube.com/watch?v=TESTVIDEO01',
  );
  await expect(page.getByRole('link', { name: 'Read the transcript ↗' })).toHaveAttribute(
    'href',
    'https://example.org/test-transcript',
  );
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect((await frame.boundingBox())!.height).toBeGreaterThanOrEqual(200);
  }
});
