import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError } from './errors';
import { MAX_UPLOAD } from './intake';
export const privateJson = (value: unknown, status = 200) =>
  NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
export function businessFailure(error: unknown) {
  if (error instanceof ZodError)
    return privateJson(
      {
        code: 'VALIDATION',
        error: 'Check the supplied fields.',
        details: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      },
      400,
    );
  if (error instanceof AppError)
    return privateJson({ code: error.code, error: error.message }, error.status);
  return privateJson(
    {
      code: 'BUSINESS_UNAVAILABLE',
      error: 'This operation could not be confirmed. Refresh its saved state before trying again.',
    },
    503,
  );
}
export async function boundedBytes(req: Request, max: number) {
  if (Number(req.headers.get('content-length') || 0) > max)
    throw new AppError(413, 'BODY_SIZE', 'Request exceeds the allowed size.');
  const reader = req.body?.getReader();
  if (!reader) throw new AppError(400, 'BODY', 'Request body required.');
  const chunks: Uint8Array[] = [];
  let size = 0,
    timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel();
  }, 20000);
  try {
    while (true) {
      const part = await reader.read();
      if (timedOut) throw new AppError(408, 'BODY_TIMEOUT', 'Upload timed out.');
      if (part.done) break;
      size += part.value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new AppError(413, 'BODY_SIZE', 'Request exceeds the allowed size.');
      }
      chunks.push(part.value);
    }
    return Buffer.concat(chunks);
  } finally {
    clearTimeout(timer);
  }
}
export async function businessBody(req: Request) {
  try {
    return JSON.parse((await boundedBytes(req, 24000)).toString('utf8'));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, 'JSON', 'Invalid JSON body.');
  }
}
export async function uploadedFile(req: Request) {
  if (!req.headers.get('content-type')?.startsWith('multipart/form-data;'))
    throw new AppError(415, 'UPLOAD', 'Use a multipart invoice upload.');
  const bytes = await boundedBytes(req, MAX_UPLOAD + 16384);
  let form: FormData;
  try {
    form = await new Request(req.url, {
      method: 'POST',
      headers: { 'content-type': req.headers.get('content-type')! },
      body: bytes,
    }).formData();
  } catch {
    throw new AppError(400, 'UPLOAD', 'Malformed upload.');
  }
  const files = form.getAll('file');
  if (files.length !== 1 || !(files[0] instanceof File))
    throw new AppError(400, 'UPLOAD', 'Select exactly one invoice document.');
  return files[0];
}
