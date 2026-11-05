import 'server-only';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { AppError } from './errors';
export const MAX_UPLOAD = 3 * 1024 * 1024;
export const MAX_PAGES = 15;
export type Extraction = {
  fields: Record<string, string>;
  metadata: {
    filename: string;
    sha256: string;
    size: number;
    outcome: string;
    fields: Record<string, { source: string; confidence: 'explicit' | 'heuristic' | 'unknown' }>;
  };
  message: string;
  mime?: string;
  source?: 'pdf' | 'txt' | 'csv' | 'image';
  sourceText?: string;
  preview?: string;
  warnings?: string[];
  missing?: string[];
  uncertain?: Record<string, string[]>;
  contacts?: string[];
  links?: string[];
  paymentDetails?: string[];
};
export function documentType(bytes: Uint8Array, filename: string) {
  const head = Buffer.from(bytes.subarray(0, 16));
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'pdf') {
    if (head.subarray(0, 5).toString() !== '%PDF-')
      throw new AppError(415, 'PDF_SIGNATURE', 'This file does not have a PDF signature.');
    return { mime: 'application/pdf', source: 'pdf' as const };
  }
  const png = head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = head[0] === 255 && head[1] === 216 && head[2] === 255;
  const webp =
    head.subarray(0, 4).toString() === 'RIFF' && head.subarray(8, 12).toString() === 'WEBP';
  if (
    (ext === 'png' && png) ||
    (['jpg', 'jpeg'].includes(ext || '') && jpeg) ||
    (ext === 'webp' && webp)
  )
    return {
      mime: png ? 'image/png' : jpeg ? 'image/jpeg' : 'image/webp',
      source: 'image' as const,
    };
  if (['txt', 'csv'].includes(ext || ''))
    return { mime: 'text/plain', source: ext as 'txt' | 'csv' };
  throw new AppError(
    415,
    'UPLOAD_TYPE',
    'Supported files: PDF, PNG, JPEG, WebP, UTF-8 TXT and single-row CSV. Content must match the file type.',
  );
}
async function deadline<T>(
  operation: Promise<T>,
  ms: number,
  cancel?: () => Promise<unknown>,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          void cancel?.().catch(() => {});
          reject(
            new AppError(
              422,
              'DOCUMENT_TIMEOUT',
              'Document processing timed out. Use a smaller document or enter the fields manually.',
            ),
          );
        }, ms);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
async function image(bytes: Uint8Array) {
  const sharp = (await import('sharp')).default;
  const instance = sharp(bytes, { limitInputPixels: 12000000, failOn: 'warning', animated: false });
  const info = await instance.metadata();
  if (!info.width || !info.height || (info.pages || 1) > 1 || info.width * info.height > 12000000)
    throw new AppError(413, 'IMAGE_DIMENSIONS', 'Use one image of at most 12 megapixels.');
  return instance
    .rotate()
    .resize({ width: 1800, height: 2400, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer();
}
async function ocr(pages: Uint8Array[]) {
  const { createWorker } = await import('tesseract.js');
  const { langPath } = await import('@tesseract.js-data/eng');
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  const stop = async () => {
    await worker?.terminate();
  };
  return deadline(
    (async () => {
      worker = await createWorker('eng', 1, {
        // External packages resolve their own Node worker/core paths at runtime.
        // Bundlers can turn require.resolve calls here into numeric module IDs.
        langPath,
        cacheMethod: 'none',
        gzip: true,
        errorHandler: () => {},
      });
      const results = [];
      for (const page of pages) results.push((await worker.recognize(Buffer.from(page))).data.text);
      return results.join('\n');
    })().finally(stop),
    25000,
    stop,
  );
}
export function extractFields(
  text: string,
  filename: string,
  bytes: Uint8Array,
  source: 'pdf' | 'txt' | 'csv' | 'image',
  ocrUsed = false,
): Extraction {
  let csvRow: Record<string, string> | undefined;
  if (source === 'csv') {
    try {
      const rows = parse(text, {
        columns: (headers: string[]) => headers.map((h) => h.trim().toLowerCase()),
        skip_empty_lines: true,
        trim: true,
        max_record_size: 16000,
        to: 2,
      }) as Record<string, string>[];
      if (rows.length !== 1) throw Error('rows');
      csvRow = rows[0];
    } catch {
      throw new AppError(
        422,
        'CSV_FORMAT',
        'Upload one invoice row with labeled headers such as vendor, number, amount and currency.',
      );
    }
  }
  const fields: Record<string, string> = {},
    metadata: Extraction['metadata']['fields'] = {},
    uncertain: Record<string, string[]> = {};
  const specs: Record<string, RegExp> = {
    vendor: /^(?:vendor|merchant|supplier|from)\s*:\s*(.+)$/gim,
    number: /^(?:invoice(?:\s*(?:number|no\.?|#))?|number)\s*[:#]\s*([^\n]+)$/gim,
    issued: /^(?:issued|issue date|invoice date|date)\s*:\s*(\d{4}-\d{2}-\d{2})/gim,
    due: /^(?:due|due date)\s*:\s*(\d{4}-\d{2}-\d{2})/gim,
    amount:
      /^(?:grand total|total(?: due)?|amount(?: due)?)\s*:\s*(?:[A-Z]{3}\s*)?([0-9][0-9,]*(?:\.[0-9]+)?)/gim,
    currency: /^currency\s*:\s*([A-Z]{3,8})/gim,
    recipient: /^(?:recipient|payment address|wallet address)\s*:\s*(0x[a-fA-F0-9]{64})/gim,
    coinType: /^coin\s*type\s*:\s*(\S+)/gim,
    tokenAmount: /^token\s*amount\s*:\s*([0-9]+(?:\.[0-9]+)?)/gim,
    memo: /^(?:memo|payment instructions?)\s*:\s*(.+)$/gim,
  };
  for (const [key, regex] of Object.entries(specs)) {
    const values = [
      ...new Set(
        (csvRow
          ? [csvRow[key.toLowerCase()]].filter(Boolean)
          : [...text.matchAll(regex)].map((v) => v[1])
        ).map((v) => v.trim()),
      ),
    ];
    if (values.length === 1) {
      fields[key] = values[0].slice(0, key === 'memo' ? 1000 : 220);
      if (key === 'amount') fields[key] = fields[key].replaceAll(',', '');
    }
    if (values.length > 1) uncertain[key] = values.slice(0, 5);
    metadata[key] = {
      source:
        values.length > 1
          ? 'Conflicting source values'
          : values.length
            ? ocrUsed
              ? 'English OCR; check source'
              : source === 'csv'
                ? 'CSV column'
                : 'Labeled text'
            : 'Not detected',
      confidence: values.length === 1 ? (ocrUsed ? 'heuristic' : 'explicit') : 'unknown',
    };
  }
  const iban = /^IBAN\s*:\s*([A-Z]{2}\d{2}[A-Z0-9 ]{10,38})$/im.exec(text)?.[1].replaceAll(' ', '');
  const bank = /^(?:bank account|account number)\s*:\s*([^\n]{4,100})$/im.exec(text)?.[1].trim();
  if (!fields.recipient && (iban || bank)) {
    fields.recipient = iban ? 'iban:' + iban : 'bank:' + bank;
    metadata.recipient = {
      source: 'Payment reference; verify independently',
      confidence: 'heuristic',
    };
  }
  const warnings: string[] = [];
  if (ocrUsed)
    warnings.push(
      'English OCR can misread names, digits and payment references. Confirm every value against the source; missing values have not been guessed.',
    );
  if (
    /\b(?:ignore|override|bypass|disregard)\b.{0,100}\b(?:rules?|instructions?|verification|safety)\b/i.test(
      text,
    )
  ) {
    warnings.push(
      'Embedded instructions attempt to influence verification. They are untrusted document content.',
    );
    if (!/ignore|override|bypass|disregard/i.test(fields.memo || ''))
      fields.memo = (
        'Untrusted document directive: ignore verification instructions. ' + (fields.memo || '')
      ).slice(0, 1000);
  }
  if (Object.keys(uncertain).length)
    warnings.push('Conflicting labeled values were not selected automatically.');
  const links = [...new Set((text.match(/https?:\/\/[^\s<>"')\]]+/gi) || []).slice(0, 30))];
  const contacts = [...new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])].slice(
    0,
    15,
  );
  const paymentDetails = text
    .split('\n')
    .filter((line) =>
      /(?:bank|account|IBAN|SWIFT|BIC|beneficiary|recipient|payment|routing)/i.test(line),
    )
    .slice(0, 25)
    .map((s) => s.slice(0, 250));
  const empty = !Object.keys(fields).length;
  return {
    fields,
    metadata: {
      filename: filename.replace(/[^\w. -]/g, '_').slice(0, 150),
      sha256: createHash('sha256').update(bytes).digest('hex'),
      size: bytes.length,
      outcome: empty ? 'no_fields' : 'editable_extraction',
      fields: metadata,
    },
    source,
    sourceText: text.slice(0, 16000),
    warnings,
    uncertain,
    links,
    contacts,
    paymentDetails,
    missing: ['vendor', 'number', 'issued', 'due', 'amount', 'currency', 'recipient'].filter(
      (k) => !fields[k],
    ),
    message: empty
      ? 'Text not detected — enter details manually'
      : 'Extracted fields are suggestions. Check and edit every field before saving.',
  };
}
export async function extractInvoice(bytes: Uint8Array, filename: string): Promise<Extraction> {
  if (!bytes.length || bytes.length > MAX_UPLOAD)
    throw new AppError(413, 'UPLOAD_SIZE', 'Upload a file between 1 byte and 3 MB.');
  const type = documentType(bytes, filename);
  let text = '',
    preview: string | undefined,
    ocrUsed = false;
  if (type.source === 'pdf') {
    // Load the provider's Node canvas globals before PDF.js evaluates.
    const { CanvasFactory, getPath } = await import('pdf-parse/worker');
    const { PDFParse } = await import('pdf-parse');
    PDFParse.setWorker(getPath());
    const parser = new PDFParse({
      // PDF.js transfers its input buffer. Preserve the original source for hashing and private retention.
      data: Uint8Array.from(bytes),
      isEvalSupported: false,
      maxImageSize: 12000000,
      useSystemFonts: false,
      disableFontFace: true,
      CanvasFactory,
    });
    try {
      const result = await deadline(
        (async () => {
          const info = await parser.getInfo({ parsePageInfo: true });
          if (info.total > MAX_PAGES)
            throw new AppError(
              413,
              'PDF_PAGES',
              'Use a PDF with at most 15 pages. Scanned PDFs support at most 3 pages.',
            );
          if (
            info.pages.some(
              (p) =>
                p.width <= 0 ||
                p.height <= 0 ||
                p.width > 14400 ||
                p.height > 14400 ||
                p.height / p.width > 3 ||
                p.width / p.height > 3,
            )
          )
            throw new AppError(413, 'PDF_DIMENSIONS', 'Use standard invoice page dimensions.');
          const extracted = await parser.getText({ parseHyperlinks: true });
          text = extracted.text;
          const needsOcr = text.replace(/-- \d+ of \d+ --/g, '').trim().length < 30;
          if (needsOcr && info.total > 3)
            throw new AppError(
              413,
              'OCR_PAGES',
              'Scanned PDFs support at most 3 pages per document.',
            );
          const screens = await parser.getScreenshot({
            partial: needsOcr ? Array.from({ length: info.total }, (_, i) => i + 1) : [1],
            desiredWidth: needsOcr ? 1600 : 800,
            imageDataUrl: false,
            imageBuffer: true,
          });
          if (screens.pages[0])
            preview =
              'data:image/jpeg;base64,' +
              (
                await (
                  await import('sharp')
                )
                  .default(screens.pages[0].data)
                  .resize({ width: 800, height: 1200, fit: 'inside', withoutEnlargement: true })
                  .jpeg({ quality: 85 })
                  .toBuffer()
              ).toString('base64');
          if (needsOcr) {
            text = await ocr(screens.pages.map((p) => p.data));
            ocrUsed = true;
          }
          const urls = info.pages
            .flatMap((p) => p.links.map((l) => l.url))
            .filter((u) => /^https?:\/\//.test(u));
          return text + (urls.length ? '\nEmbedded links:\n' + urls.join('\n') : '');
        })(),
        40000,
        () => parser.destroy(),
      );
      text = result;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        422,
        'PDF_PARSE',
        'Unable to read this PDF. It may be encrypted, damaged or unreadable; enter details manually.',
      );
    } finally {
      await parser.destroy().catch(() => {});
    }
  } else if (type.source === 'image') {
    try {
      const pixels = await image(bytes);
      preview =
        'data:image/jpeg;base64,' +
        (
          await (
            await import('sharp')
          )
            .default(pixels)
            .resize({ width: 800, height: 1200, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer()
        ).toString('base64');
      text = await ocr([pixels]);
      ocrUsed = true;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        422,
        'IMAGE_PARSE',
        'This image could not be read. Use a clear single-page image or enter details manually.',
      );
    }
  } else {
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new AppError(415, 'TEXT_FORMAT', 'Use valid UTF-8 text.');
    }
    if (/[\x00-\x08\x0e-\x1f]/.test(text) || /<(?:script|html|svg)\b/i.test(text))
      throw new AppError(
        415,
        'TEXT_FORMAT',
        'Executable, HTML and binary documents are not supported.',
      );
  }
  const result = extractFields(text.slice(0, 64000), filename, bytes, type.source, ocrUsed);
  if (text.length > 64000)
    result.warnings!.push(
      'The extracted text exceeded the processing limit. Review the source for omitted information.',
    );
  return { ...result, mime: type.mime, preview };
}
