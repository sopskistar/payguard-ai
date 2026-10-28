import 'server-only';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { AppError } from './errors';
export const MAX_UPLOAD = 5 * 1024 * 1024;
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
};
export async function extractInvoice(bytes: Uint8Array, filename: string): Promise<Extraction> {
  if (!bytes.length || bytes.length > MAX_UPLOAD)
    throw new AppError(413, 'UPLOAD_SIZE', 'Upload a file between 1 byte and 5 MB.');
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext || !['pdf', 'txt', 'csv'].includes(ext))
    throw new AppError(415, 'UPLOAD_TYPE', 'Supported files: text-based PDF, TXT and CSV.');
  let text = '';
  let csvRow: Record<string, string> | undefined;
  if (ext === 'pdf') {
    if (Buffer.from(bytes.subarray(0, 5)).toString() !== '%PDF-')
      throw new AppError(415, 'PDF_SIGNATURE', 'This file does not have a PDF signature.');
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: bytes });
    try {
      const info = await parser.getInfo();
      if (info.total > 25) throw new AppError(413, 'PDF_PAGES', 'Use a PDF with at most 25 pages.');
      const result = await parser.getText();
      text = result.text;
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError(
        422,
        'PDF_PARSE',
        'Unable to read this PDF. It may be encrypted or damaged; enter details manually.',
      );
    } finally {
      await parser.destroy();
    }
  } else {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (text.includes('\0'))
      throw new AppError(415, 'TEXT_FORMAT', 'The file contains binary content. Use UTF-8 text.');
    if (ext === 'csv') {
      try {
        const rows = parse(text, {
          columns: (headers: string[]) => headers.map((h) => h.trim().toLowerCase()),
          skip_empty_lines: true,
          trim: true,
          max_record_size: 16000,
          to: 2,
        }) as Record<string, string>[];
        if (rows.length !== 1) throw new Error('rows');
        csvRow = rows[0];
      } catch {
        throw new AppError(
          422,
          'CSV_FORMAT',
          'Upload one invoice row with headers vendor, number, issued, due, amount, currency, recipient, coinType, tokenAmount, memo.',
        );
      }
    }
  }
  const fields: Record<string, string> = {};
  const metadata: Extraction['metadata']['fields'] = {};
  const specs: Record<string, RegExp> = {
    vendor: /^(?:vendor|merchant|supplier)\s*:\s*(.+)$/im,
    number: /^(?:invoice(?:\s*(?:number|no\.?|#))?|number)\s*:\s*([^\n]+)$/im,
    issued: /^(?:issued|issue date|date)\s*:\s*(\d{4}-\d{2}-\d{2})/im,
    due: /^(?:due|due date)\s*:\s*(\d{4}-\d{2}-\d{2})/im,
    amount: /^(?:total|amount)\s*:\s*(?:[A-Z]{3}\s*)?([0-9]+(?:\.[0-9]+)?)/im,
    currency: /^currency\s*:\s*([A-Z]{3,8})/im,
    recipient: /^recipient\s*:\s*(0x[a-fA-F0-9]{64})/im,
    coinType: /^coin\s*type\s*:\s*(\S+)/im,
    tokenAmount: /^token\s*amount\s*:\s*([0-9]+(?:\.[0-9]+)?)/im,
    memo: /^memo\s*:\s*(.+)$/im,
  };
  for (const [key, re] of Object.entries(specs)) {
    const value = csvRow?.[key.toLowerCase()] || (!csvRow ? re.exec(text)?.[1] : undefined);
    if (value) {
      fields[key] = value.trim().slice(0, key === 'memo' ? 1000 : 220);
      metadata[key] = {
        source: ext === 'csv' ? 'CSV column' : 'Labeled text',
        confidence: 'explicit',
      };
    } else metadata[key] = { source: 'Not detected', confidence: 'unknown' };
  }
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
    message: empty
      ? 'Text not detected — enter details manually'
      : 'Extracted fields are suggestions. Check and edit every field before saving.',
  };
}
