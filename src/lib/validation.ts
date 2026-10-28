import { z } from 'zod';
import { fromBase58 } from '@mysten/sui/utils';
export const address = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Use a full 0x-prefixed 32-byte Sui address').transform(s => s.toLowerCase());
export const digestSchema = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/, 'Enter a valid base58 Sui transaction digest').refine(s=>{try{return fromBase58(s).length===32;}catch{return false;}},'Digest must encode 32 bytes');
export const decimal = z.string().regex(/^(0|[1-9]\d{0,17})(\.\d{1,18})?$/, 'Use a positive decimal amount, without commas').refine(s => /[1-9]/.test(s), 'Amount must be greater than zero');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s, 'Use a valid date');
export const coinType = z.string().max(220).regex(/^0x[a-fA-F0-9]{1,64}::[A-Za-z_][A-Za-z0-9_]*::[A-Za-z_][A-Za-z0-9_]*$/, 'Use a Sui coin type');
export const invoiceInput = z.object({
  vendor: z.string().trim().min(2).max(100), number: z.string().trim().min(1).max(80), issued: date, due: date,
  amount: decimal, currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3,8}$/), memo: z.string().max(1000).default(''),
  recipient: z.union([address, z.literal('')]).default(''), wallet: z.union([address, z.literal('')]).default(''),
  coinType: z.union([coinType, z.literal('')]).default(''), tokenAmount: z.union([decimal, z.literal('')]).default(''),
  isDemo: z.boolean().default(false), source: z.enum(['manual','pdf','txt','csv']).default('manual'), importKey: z.string().uuid(),
  extraction: z.object({ filename: z.string().max(150), sha256: z.string().regex(/^[a-f0-9]{64}$/), size: z.number().int().min(1).max(5*1024*1024), outcome: z.string().max(100), fields: z.record(z.string(), z.object({ source: z.string().max(40), confidence: z.enum(['explicit','heuristic','unknown']) })) }).optional(),
}).refine(v => !v.tokenAmount || !!v.coinType, { message: 'Choose a coin type for the agreed token amount', path: ['coinType'] });
export const correctionInput = z.object({ invoiceId: z.string().uuid(), findingId: z.string().min(1).max(100), action: z.enum(['correct','remember','exception','escalate','dismiss']), explanation: z.string().trim().min(8).max(1000), scope: z.enum(['invoice','vendor','all']), future: z.boolean(), kind: z.enum(['verify_address','threshold','escalate','exception','duplicate']), value: z.union([decimal,z.literal('')]).default(''), hard: z.boolean().default(false), consent: z.boolean(), operationKey: z.string().uuid() }).refine(v => !v.future || v.consent, { message: 'Review and consent to the minimized memory before saving', path: ['consent'] }).refine(v => v.kind !== 'threshold' || !!v.value, { message: 'A threshold policy needs an amount', path: ['value'] });
export const settingsInput = z.object({ currency: z.string().regex(/^[A-Z]{3,8}$/), threshold: decimal, allowedTokens: z.array(coinType).min(1).max(20), alerts: z.boolean() });
export function canonicalCoin(s: string) { const [pkg, mod, name] = s.split('::'); return `${pkg.toLowerCase().replace(/^0x0+/, '0x') || '0x0'}::${mod}::${name}`; }
export function units(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 38 || !/^\d+(\.\d+)?$/.test(value)) throw new Error('Invalid token precision');
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > decimals && /[1-9]/.test(fraction.slice(decimals))) throw new Error('Amount exceeds token precision');
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.slice(0, decimals).padEnd(decimals,'0') || '0');
}
