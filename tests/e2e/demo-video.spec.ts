import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import config from '../../src/content/demo-video.json' with { type: 'json' };
import { resolveDemoVideo } from '../../src/lib/demo-video';
import { visit, registerBrowserDiagnostics } from './browser-helpers';
registerBrowserDiagnostics();
let bundle: string, css: string, poster: Buffer;
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
  poster = await readFile('public/demo-approved-poster.png');
});
test('approved demo has one optional homepage player and compact links on public demo and proof', async ({
  page,
}) => {
  const approved = resolveDemoVideo(config)!;
  expect(approved.watchUrl).toBe('https://youtu.be/i2ZsEPIegy4');
  let providerRequests = 0;
  page.on('request', (request) => {
    if (/youtube|ytimg|googlevideo/.test(new URL(request.url()).hostname)) providerRequests++;
  });
  for (const path of ['/', '/try', '/proof']) {
    await visit(page, path);
    await expect(page.locator('h1').first()).toBeVisible();
    const region = page.getByRole('region', { name: 'Official demo video', exact: true });
    if (path === '/') {
      await expect(region).toBeVisible();
      await expect(region.getByRole('link', { name: 'Watch on YouTube ↗' })).toHaveAttribute(
        'href',
        approved.watchUrl,
      );
      const poster = region.getByRole('img');
      await expect(poster).toBeVisible();
      expect(await poster.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(3840);
    } else {
      await expect(region).toHaveCount(0);
      await expect(
        page.getByRole('link', { name: 'Watch the 2:46 demo on YouTube ↗' }),
      ).toHaveAttribute('href', approved.watchUrl);
    }
    await expect(page.locator('iframe')).toHaveCount(0);
  }
  expect(providerRequests).toBe(0);
});
test('controlled player fixture loads only on keyboard activation, retains captions/fallback and fits mobile', async ({
  page,
}) => {
  let providerRequests = 0;
  await page.route('http://video-fixture.test/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/app.js') return route.fulfill({ contentType: 'text/javascript', body: bundle });
    if (path === '/demo-approved-poster.png')
      return route.fulfill({ contentType: 'image/png', body: poster });
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
  await expect(page.getByRole('status')).toContainText('If the embedded player is blocked');
  const source = new URL((await frame.getAttribute('src'))!);
  expect(source.searchParams.has('autoplay')).toBe(false);
  expect(source.searchParams.get('disablekb')).toBe('0');
  expect(source.searchParams.get('controls')).toBe('1');
  const desktop = (await frame.boundingBox())!;
  expect(desktop.width / desktop.height).toBeCloseTo(16 / 9, 1);
  await expect(page.getByRole('link', { name: 'Watch on YouTube ↗' })).toHaveAttribute(
    'href',
    'https://youtu.be/TESTVIDEO01',
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

test('slow or blocked embed keeps a visible status and keyboard-accessible external fallback', async ({
  page,
}) => {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('http://video-fixture.test/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/app.js') return route.fulfill({ contentType: 'text/javascript', body: bundle });
    if (path === '/demo-approved-poster.png')
      return route.fulfill({ contentType: 'image/png', body: poster });
    return route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}${css}</style></head><body><main id="root"></main><script src="/app.js"></script></body></html>`,
    });
  });
  await page.route('https://www.youtube-nocookie.com/**', async (route) => {
    await released;
    await route.abort('blockedbyclient');
  });
  try {
    await page.goto('http://video-fixture.test/approved');
    await page.getByRole('button', { name: 'Load Controlled video fixture on YouTube' }).click();
    await expect(page.getByRole('status')).toHaveText('Opening the YouTube player…');
    const fallback = page.getByRole('link', { name: 'Watch on YouTube ↗' });
    await fallback.focus();
    await expect(fallback).toBeFocused();
    await expect(fallback).toHaveAttribute('href', 'https://youtu.be/TESTVIDEO01');
    await expect(fallback).toHaveAttribute('target', '_blank');
    release();
    await expect(page.getByRole('status')).toContainText(/blocked|could not load/);
    await expect(fallback).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    release();
  }
});
