import { z } from 'zod';
// Supplier references may be bank instructions. Service payments still use the
// unchanged strict Sui-address schema in service-protocol.
export const recipientReference = z
  .string()
  .trim()
  .max(170)
  .refine(
    (v) =>
      /^0x[a-fA-F0-9]{64}$/.test(v) ||
      /^iban:[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/i.test(v) ||
      /^bank:[^\x00-\x1f<>]{4,160}$/.test(v),
    'Use a full Sui address, iban: reference, or bank: account reference.',
  )
  .transform((v) =>
    v.startsWith('0x')
      ? v.toLowerCase()
      : /^iban:/i.test(v)
        ? 'iban:' + v.slice(5).toUpperCase()
        : 'bank:' + v.slice(5),
  );
