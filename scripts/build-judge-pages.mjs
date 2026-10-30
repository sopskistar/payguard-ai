import { build } from 'esbuild';
import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
await mkdir('docs/try/brand', { recursive: true });
await copyFile('public/brand/icon.png', 'docs/try/brand/icon.png');
await build({
  entryPoints: ['scripts/judge-pages-entry.tsx'],
  bundle: true,
  minify: true,
  conditions: ['style', 'browser', 'import'],
  jsx: 'automatic',
  outdir: 'docs/try',
  entryNames: 'app',
  assetNames: 'assets/[name]-[hash]',
  loader: { '.woff2': 'file', '.woff': 'file' },
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [
    {
      name: 'static-pages-links',
      setup(b) {
        b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'pages-link' }));
        b.onLoad({ filter: /.*/, namespace: 'pages-link' }, () => ({
          contents: `import {createElement} from 'react';export default function Link({href,children,...props}){return createElement('a',{...props,href:href.startsWith('/')?'https://payguard-ai-henna.vercel.app'+href:href},children)}`,
          resolveDir: process.cwd(),
          loader: 'js',
        }));
        b.onLoad({ filter: /(?:judge-sandbox|brand)\.tsx$/ }, async (args) => ({
          contents: (await readFile(args.path, 'utf8')).replaceAll(
            'src="/brand/icon.png"',
            'src="brand/icon.png"',
          ),
          loader: 'tsx',
          resolveDir: process.cwd() + '/src/components',
        }));
      },
    },
  ],
});
await writeFile(
  'docs/try/index.html',
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PayGuard Verify — Three-minute judge sandbox</title><meta name="description" content="Account-free synthetic supplier verification with real recorded Mainnet evidence."><link rel="stylesheet" href="app.css"></head><body><a class="skip-link" href="#main">Skip to content</a><div id="judge-root"></div><script src="app.js" defer></script></body></html>',
);
console.log(
  'Published judge artifact built from the actual JudgeSandbox component. No provider credentials or private records included.',
);
