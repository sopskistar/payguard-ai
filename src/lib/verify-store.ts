import 'server-only';
import {createHash} from 'node:crypto';
import {and,eq,desc} from 'drizzle-orm';
import {z} from 'zod';
import {db,type Database} from '@/db';
import * as s from '@/db/schema';
import {address, units} from './validation';
import {AppError} from './errors';
import {approvalGate,instructionSignals} from './verify';
import type {VendorTrust,PaymentInstruction,HumanVerification,Invoice} from './types';
export const profileInput=z.object({vendorId:z.string().uuid(),trustedRecipient:address,emailDomain:z.string().trim().toLowerCase().max(253).regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/),contactLabel:z.string().trim().min(2).max(100),contactMethod:z.enum(['phone','in_person','secure_portal']),contactReference:z.string().trim().min(5).max(180),establishedAt:z.iso.datetime().refine(v=>Date.parse(v)<=Date.now(),'Contact date must not be in the future'),independentlySourced:z.literal(true)});
export const instructionInput=z.object({invoiceId:z.string().uuid(),senderEmail:z.email().max(254),replyTo:z.union([z.email().max(254),z.literal('')]),message:z.string().trim().min(5).max(3000),requestedContact:z.string().max(180),receivedAt:z.iso.datetime().refine(v=>Date.parse(v)<=Date.now(),'Received date must not be in the future')});
export const humanInput=z.object({invoiceId:z.string().uuid(),profileRevision:z.number().int().positive(),instructionHash:z.string().regex(/^[a-f0-9]{64}$/),outcome:z.enum(['confirmed','rejected','inconclusive']),method:z.enum(['phone','in_person','secure_portal']),note:z.string().trim().min(12).max(1000),usedEstablishedContact:z.literal(true)});
export function instructionHash(invoice:Invoice,instruction?:PaymentInstruction){return createHash('sha256').update(JSON.stringify({vendorId:invoice.vendorId,recipient:invoice.recipient,number:invoice.number,currency:invoice.currency,issued:invoice.issued,due:invoice.due,memo:invoice.memo,wallet:invoice.wallet,amount:units(invoice.amount,18).toString(),coinType:invoice.coinType,tokenAmount:invoice.tokenAmount,instruction:instruction?{senderEmail:instruction.senderEmail,replyTo:instruction.replyTo,message:instruction.message,requestedContact:instruction.requestedContact,receivedAt:instruction.receivedAt}:null})).digest('hex');}
export async function listTrust(tenantId:string,connection?:Database):Promise<VendorTrust[]>{const rows=await(connection||await db()).select({p:s.vendorTrustProfiles,v:s.vendors}).from(s.vendorTrustProfiles).innerJoin(s.vendors,eq(s.vendorTrustProfiles.vendorId,s.vendors.id)).where(eq(s.vendorTrustProfiles.tenantId,tenantId));return rows.map(({p,v})=>({...p,name:v.name,isDemo:v.isDemo,contactMethod:p.contactMethod as VendorTrust['contactMethod'],establishedAt:p.establishedAt.toISOString()}));}
export async function trustContext(tenantId:string,invoice:Invoice,connection?:Database){const d=connection||await db();const [profiles,instructions,checks]=await Promise.all([listTrust(tenantId,d),d.select().from(s.paymentInstructions).where(and(eq(s.paymentInstructions.tenantId,tenantId),eq(s.paymentInstructions.invoiceId,invoice.id))),d.select().from(s.humanVerifications).where(and(eq(s.humanVerifications.tenantId,tenantId),eq(s.humanVerifications.invoiceId,invoice.id))).orderBy(desc(s.humanVerifications.checkedAt))]);const profile=profiles.find(p=>p.vendorId===invoice.vendorId);const row=instructions[0];const instruction:PaymentInstruction|undefined=row?{invoiceId:row.invoiceId,senderEmail:row.senderEmail,replyTo:row.replyTo,message:row.message,requestedContact:row.requestedContact,receivedAt:row.receivedAt.toISOString()}:undefined;const hash=instructionHash(invoice,instruction);const verification=checks[0]?{...checks[0],checkedAt:checks[0].checkedAt.toISOString()} as HumanVerification:undefined;return {profile,instruction,verification,instructionHash:hash,signals:instructionSignals(invoice,profile,instruction),gate:approvalGate(invoice,profile,instruction,verification,hash)};}
export async function saveTrust(tenantId:string,input:z.infer<typeof profileInput>){const d=await db();await d.transaction(async tx=>{const [vendor]=await tx.select().from(s.vendors).where(and(eq(s.vendors.tenantId,tenantId),eq(s.vendors.id,input.vendorId))).for('update');if(!vendor)throw new AppError(404,'NOT_FOUND','Vendor not found.');const [old]=await tx.select().from(s.vendorTrustProfiles).where(eq(s.vendorTrustProfiles.vendorId,input.vendorId));const values={tenantId,vendorId:input.vendorId,trustedRecipient:input.trustedRecipient,emailDomain:input.emailDomain,contactLabel:input.contactLabel,contactMethod:input.contactMethod,contactReference:input.contactReference,establishedAt:new Date(input.establishedAt),revision:(old?.revision||0)+1,updatedAt:new Date()};await tx.insert(s.vendorTrustProfiles).values(values).onConflictDoUpdate({target:s.vendorTrustProfiles.vendorId,set:values});await tx.insert(s.auditEvents).values({tenantId,type:'vendor.trust_updated',entityId:vendor.id,detail:{revision:values.revision,independentlySourced:true,priorAttestationsInvalidated:true}});});}
export async function saveInstructions(tenantId:string,input:z.infer<typeof instructionInput>){
 await(await db()).transaction(async tx=>{
  const [invoice]=await tx.select().from(s.invoices).where(and(eq(s.invoices.id,input.invoiceId),eq(s.invoices.tenantId,tenantId))).for('update');
  if(!invoice)throw new AppError(404,'NOT_FOUND','Invoice not found.');
  if(invoice.status!=='open')throw new AppError(409,'LOCKED','Reopen this invoice before changing its instructions.');
  const values={...input,tenantId,receivedAt:new Date(input.receivedAt),updatedAt:new Date()};
  await tx.insert(s.paymentInstructions).values(values).onConflictDoUpdate({target:s.paymentInstructions.invoiceId,set:values});
  await tx.insert(s.auditEvents).values({tenantId,type:'instructions.updated',entityId:invoice.id,detail:{priorAttestationsInvalidated:true}});
 });
}
export async function recordHumanCheck(tenantId:string,input:z.infer<typeof humanInput>){
 return(await db()).transaction(async tx=>{
  const [row]=await tx.select().from(s.invoices).where(and(eq(s.invoices.id,input.invoiceId),eq(s.invoices.tenantId,tenantId))).for('update');
  if(!row)throw new AppError(404,'NOT_FOUND','Invoice not found.');
  const [vendor]=await tx.select().from(s.vendors).where(eq(s.vendors.id,row.vendorId)).for('update');
  const invoice={...row,vendor:vendor.name,createdAt:row.createdAt.toISOString()} as Invoice;
  const context=await trustContext(tenantId,invoice,tx as unknown as Database);
  if(!context.profile)throw new AppError(409,'NO_TRUST_ANCHOR','Establish the vendor’s independent contact first.');
  if(context.profile.revision!==input.profileRevision||context.instructionHash!==input.instructionHash)throw new AppError(409,'STALE_VERIFICATION','Instructions or trust profile changed. Refresh before recording verification.');
  if(context.profile.contactMethod!==input.method)throw new AppError(400,'CHANNEL_MISMATCH','Use the channel recorded in the established vendor profile.');
  if(context.instruction&&Date.parse(context.profile.establishedAt)>=Date.parse(context.instruction.receivedAt))throw new AppError(409,'NEW_CONTACT','This contact does not predate the request and cannot validate it.');
  const [check]=await tx.insert(s.humanVerifications).values({tenantId,invoiceId:invoice.id,recipient:invoice.recipient,instructionHash:context.instructionHash,profileRevision:context.profile.revision,outcome:input.outcome,method:input.method,note:input.note}).returning();
  await tx.insert(s.auditEvents).values({tenantId,type:'instructions.human_verified',entityId:invoice.id,detail:{verificationId:check.id,outcome:input.outcome,profileRevision:input.profileRevision,source:'human attestation; not independently observed by the app'}});
  return check;
 });
}
