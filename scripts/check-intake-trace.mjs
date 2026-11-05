// Verify extraction using only dependencies present in the actual serverless trace.
// No database, provider credentials, financial operation or network download.
import { readFile, mkdtemp, mkdir, copyFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const root = process.cwd();
const manifest = resolve('.next/server/app/api/business/[[...path]]/route.js.nft.json');
const files = JSON.parse(await readFile(manifest, 'utf8')).files.map((f) =>
  resolve(dirname(manifest), f),
);
for (const suffix of [
  '/pdf-parse/dist/worker/pdf.worker.mjs',
  '/@napi-rs/canvas-linux-x64-gnu/skia.linux-x64-gnu.node',
  '/tesseract.js/src/worker-script/node/index.js',
  '/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz',
])
  if (!files.some((f) => f.endsWith(suffix)))
    throw Error('INTAKE_TRACE_RESOURCE_MISSING: ' + suffix);
const temporary = await mkdtemp(join(tmpdir(), 'payguard-intake-trace-'));
try {
  for (const file of files.filter((f) => f.startsWith(join(root, 'node_modules') + '/'))) {
    const destination = join(temporary, relative(root, file));
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(file, destination);
  }
  const require = createRequire(join(temporary, 'package.json'));
  const { CanvasFactory, getPath } = require('pdf-parse/worker');
  const { PDFParse } = require('pdf-parse');
  PDFParse.setWorker(getPath());
  const parser = new PDFParse({
    data: new Uint8Array(await readFile('public/samples/northstar-invoice.pdf')),
    CanvasFactory,
    isEvalSupported: false,
  });
  let text, preview;
  try {
    text = (await parser.getText()).text;
    preview = await parser.getScreenshot({
      partial: [1],
      desiredWidth: 600,
      imageDataUrl: false,
      imageBuffer: true,
    });
  } finally {
    await parser.destroy();
  }
  if (!text.includes('Northstar Studio') || !preview.pages[0]?.data.length)
    throw Error('PACKAGED_PDF_FAILED');
  const { createWorker } = require('tesseract.js'),
    { langPath } = require('@tesseract.js-data/eng');
  const worker = await createWorker('eng', 1, {
    langPath,
    cacheMethod: 'none',
    gzip: true,
    errorHandler: () => {},
  });
  let ocr;
  try {
    ocr = (await worker.recognize(await readFile('tests/fixtures/synthetic-ocr-invoice.png'))).data
      .text;
  } finally {
    await worker.terminate();
  }
  if (!ocr.includes('Synthetic OCR Studio') || !ocr.includes('1250.00'))
    throw Error('PACKAGED_OCR_FAILED');
  const report = {
    checkedAt: new Date().toISOString(),
    builtTrace: relative(root, manifest),
    isolatedDependencies: true,
    sourceNodeModulesFallback: false,
    realPdfText: true,
    realPdfRasterPreview: true,
    realLocalImageOcr: true,
    databaseAccess: false,
    financialOperations: 0,
    providerWrites: 0,
  };
  await writeFile(
    'docs/evidence/business-intake-packaged-validation.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
