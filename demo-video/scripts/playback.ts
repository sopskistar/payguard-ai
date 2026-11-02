/** Offline export acceptance only; no application routes, credentials or provider calls. */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const single = process.argv.includes('--single');
const names = single
  ? ['payguard-demo-final.mp4']
  : ['payguard-demo-final.mp4', 'payguard-demo-captioned.mp4'];
const server = createServer(async (req, res) => {
  const name = (req.url || '').slice(1);
  if (req.method !== 'GET' || !names.includes(name)) {
    res.writeHead(404).end();
    return;
  }
  const path = resolve(root, name),
    size = (await stat(path)).size;
  const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
  const start = range ? Number(range[1]) : 0;
  const end = range && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
  if (start > end || start >= size) {
    res.writeHead(416).end();
    return;
  }
  res.writeHead(range ? 206 : 200, {
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Content-Length': end - start + 1,
    ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
  });
  createReadStream(path, { start, end }).pipe(res);
});
await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
const address = server.address();
if (!address || typeof address === 'string') throw Error('Offline preview server unavailable');
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({
  headless: true,
  executablePath: '/home/sopski/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
});
try {
  const results = await Promise.all(
    names.map(async (name) => {
      const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      await context.route('**/*', async (route) => {
        if (route.request().method() === 'GET' && new URL(route.request().url()).origin === origin)
          await route.continue();
        else await route.abort('blockedbyclient');
      });
      const page = await context.newPage();
      await page.setContent(
        `<video muted playsinline style="width:100%" src="${origin}/${name}"></video>`,
      );
      await page.evaluate(async () => {
        await document.querySelector('video')!.play();
      });
      // Full timeline, at normal speed. Seeking through a few frames is a different check.
      await page.waitForFunction(
        () => {
          const v = document.querySelector('video')!;
          if (v.error) throw Error('Offline video decode error ' + v.error.code);
          return v.ended;
        },
        undefined,
        { timeout: 200000, polling: 1000 },
      );
      const result = await page.evaluate(() => {
        const v = document.querySelector('video')!;
        const q = v.getVideoPlaybackQuality();
        return {
          duration: v.duration,
          ended: v.ended,
          currentTime: v.currentTime,
          width: v.videoWidth,
          height: v.videoHeight,
          playbackRate: v.playbackRate,
          muted: v.muted,
          error: v.error?.code || null,
          quality: {
            totalFrames: q.totalVideoFrames,
            droppedFrames: q.droppedVideoFrames,
            corruptedFrames: q.corruptedVideoFrames,
          },
        };
      });
      await context.close();
      return { file: name, ...result };
    }),
  );
  await writeFile(
    root + (single ? '/render/browser-playback-single.json' : '/render/browser-playback.json'),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        engine: 'Real Chromium HTML video playback, complete timeline at 1×',
        network: 'Offline loopback media files only; application and provider access blocked',
        humanCreativeApproval: false,
        results,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
  server.close();
}
