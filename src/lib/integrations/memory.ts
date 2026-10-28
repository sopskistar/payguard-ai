import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { MemWal, MemWalRememberJobFailedError } from '@mysten-incubation/memwal';
import { and, eq, or, lt, isNull } from 'drizzle-orm';
import { db } from '@/db';
import * as s from '@/db/schema';
import type { Citation, Policy } from '../types';
import { AppError, safeError, unavailable } from '../errors';
import { audit, ownedInvoice, listInvoices, preferences, policies, seedDemo } from '../store';
import { correctionInput } from '../validation';
import { evaluate } from '../risk';
import { rateLimit } from '../auth';
import { seedEvents } from '../demo';
import type { z } from 'zod';
export const namespaceFor=(tenantId:string)=>`payguard-v1-${createHash('sha256').update(tenantId).digest('hex').slice(0,32)}`;
export const vendorReference=(tenantId:string,vendorId:string)=>`vendor-${createHash('sha256').update(tenantId+':'+vendorId).digest('hex').slice(0,16)}`;
export function memoryConfigured() { return !!(process.env.DATABASE_URL&&process.env.MEMWAL_PRIVATE_KEY&&process.env.MEMWAL_ACCOUNT_ID); }
export function memoryClient(tenantId:string) {
 if(!memoryConfigured()) unavailable('Walrus Mainnet (requires Neon, delegate key and account ID)');
 const serverUrl=process.env.MEMWAL_SERVER_URL||'https://relayer.memory.walrus.xyz';
 // This build only makes Mainnet claims for the documented managed Mainnet relayer.
 if(serverUrl!=='https://relayer.memory.walrus.xyz') throw new AppError(503,'RELAYER_NETWORK','Use the managed Mainnet Walrus relayer. Custom/testnet relayers are not accepted as Mainnet proof.');
 return MemWal.create({key:process.env.MEMWAL_PRIVATE_KEY!,accountId:process.env.MEMWAL_ACCOUNT_ID!,serverUrl,namespace:namespaceFor(tenantId),requestTimeoutMs:12000,recallTimeoutMs:12000,preflightTimeoutMs:4000});
}
export function policyText(kind:Policy['kind'],value='') {
 const templates:Record<Policy['kind'],string>={verify_address:'Always require independent verification for new or changed payout addresses.',threshold:`Require manual approval above ${value} in the configured review currency.`,escalate:'Escalate future recipient changes or repeated billing patterns after a previous incident.',exception:'A human confirmed an exception. Check applicability; never suppress mandatory safety checks.',duplicate:'A prior billing incident requires comparison of service periods and line items on future duplicate matches.'};
 return templates[kind];
}
export function minimizedMemory(tenantId:string,policy:Policy,isDemo:boolean) {
 return `PayGuard user-approved payment-review policy. ${policy.text} Scope: ${policy.scope}. Vendor reference: ${policy.vendorId?vendorReference(tenantId,policy.vendorId):'all vendors'}. ${isDemo?'Synthetic business event.':'Minimized business policy.'}\n${JSON.stringify({version:1,policyId:policy.id,kind:policy.kind,scope:policy.scope,vendorRef:policy.vendorId?vendorReference(tenantId,policy.vendorId):null,value:policy.value||null})}`;
}
export async function recordCorrection(tenantId:string,input:z.infer<typeof correctionInput>) {
 const invoice=await ownedInvoice(tenantId,input.invoiceId); if(input.future&&!memoryConfigured()) unavailable('Walrus Mainnet');
 const d=await db(); const op=`correction-${input.operationKey}`;
 const [existing]=await d.select().from(s.memoryJobs).where(and(eq(s.memoryJobs.tenantId,tenantId),eq(s.memoryJobs.operationKey,op)));
 if(existing) return existing;
 const jobId=await d.transaction(async tx=>{
  const [decision]=await tx.insert(s.reviewDecisions).values({tenantId,invoiceId:invoice.id,action:input.action,findingId:input.findingId,explanation:input.explanation,scope:input.scope,future:input.future}).returning();
  await tx.insert(s.auditEvents).values({tenantId,type:'review.correction',entityId:invoice.id,detail:{decisionId:decision.id,action:input.action,findingId:input.findingId,scope:input.scope,future:input.future}});
  if(!input.future) return null;
  const policy:Policy={id:randomUUID(),vendorId:input.scope==='all'?null:invoice.vendorId,invoiceId:input.scope==='invoice'?invoice.id:null,kind:input.kind,value:input.value,text:policyText(input.kind,input.value),hard:input.hard,scope:input.scope,active:true};
  await tx.insert(s.userRules).values({id:policy.id,tenantId,vendorId:policy.vendorId,invoiceId:policy.invoiceId,decisionId:decision.id,policy});
  const [job]=await tx.insert(s.memoryJobs).values({tenantId,invoiceId:invoice.id,policyId:policy.id,operationKey:op,namespace:namespaceFor(tenantId),intent:input.action,text:minimizedMemory(tenantId,policy,invoice.isDemo),accountId:process.env.MEMWAL_ACCOUNT_ID,isDemo:invoice.isDemo}).returning();
  await tx.insert(s.auditEvents).values({tenantId,type:'memory.requested',entityId:job.id,detail:{operationKey:op,policyId:policy.id}});
  return job.id;
 });
 return jobId?processMemoryJob(tenantId,jobId):{status:'saved',id:null};
}
export async function processMemoryJob(tenantId:string,id:string) {
 const d=await db(); const [current]=await d.select().from(s.memoryJobs).where(and(eq(s.memoryJobs.tenantId,tenantId),eq(s.memoryJobs.id,id)));
 if(!current) throw new AppError(404,'NOT_FOUND','Memory job not found.');
 if(current.status==='confirmed'||current.status==='failed') return current;
 const client=memoryClient(tenantId);
 const [job]=await d.update(s.memoryJobs).set({leaseUntil:new Date(Date.now()+120000)}).where(and(eq(s.memoryJobs.id,id),eq(s.memoryJobs.tenantId,tenantId),eq(s.memoryJobs.status,'pending'),or(isNull(s.memoryJobs.leaseUntil),lt(s.memoryJobs.leaseUntil,new Date())))).returning();
 if(!job) return current;
 let acceptedId=job.jobId;
 try {
  if(!acceptedId) {
   await rateLimit(`${tenantId}:memory-write`,Math.min(100,Number(process.env.MEMORY_WRITES_PER_HOUR)||24));
   const accepted=await client.remember(job.text,job.namespace,{idempotencyKey:job.operationKey});
   acceptedId=accepted.job_id;
   await d.update(s.memoryJobs).set({jobId:acceptedId,error:null}).where(eq(s.memoryJobs.id,id));
   await audit(tenantId,'memory.accepted',id,{jobId:acceptedId});
  }
  const result=await client.waitForRememberJob(acceptedId,{timeoutMs:18000,pollIntervalMs:1500});
  if(!result.blob_id||result.namespace!==job.namespace||(result.job_id||result.id)!==acceptedId) throw new AppError(502,'MEMORY_PROOF','Memory completion did not match the accepted job and namespace.');
  await d.transaction(async tx=>{
   await tx.update(s.memoryJobs).set({status:'confirmed',blobId:result.blob_id,completedAt:new Date(),error:null,leaseUntil:null}).where(and(eq(s.memoryJobs.id,id),eq(s.memoryJobs.tenantId,tenantId)));
   await tx.insert(s.auditEvents).values({tenantId,type:'memory.confirmed',entityId:id,detail:{jobId:acceptedId,blobId:result.blob_id,accountId:job.accountId,network:'mainnet'}});
  });
 } catch(error) {
  const failed=error instanceof MemWalRememberJobFailedError;
  await d.update(s.memoryJobs).set({status:failed?'failed':'pending',error:failed?'Walrus reported a terminal failure. Inspect the job in the Memory dashboard.':safeError(error),leaseUntil:null}).where(eq(s.memoryJobs.id,id));
  await audit(tenantId,failed?'memory.failed':'memory.pending',id,{jobId:acceptedId,reason:failed?'terminal provider failure':'not confirmed; resume same operation'});
 }
 const [result]=await d.select().from(s.memoryJobs).where(and(eq(s.memoryJobs.id,id),eq(s.memoryJobs.tenantId,tenantId))); return result;
}
export async function recallMemories(tenantId:string,query:string,invoiceId:string|null=null) {
 const client=memoryClient(tenantId); await rateLimit(`${tenantId}:memory-read`,60);
 const d=await db();
 const jobs=await d.select().from(s.memoryJobs).where(and(eq(s.memoryJobs.tenantId,tenantId),eq(s.memoryJobs.status,'confirmed')));
 const result=await client.recall({query,namespace:namespaceFor(tenantId),limit:12});
 // Recalled text is untrusted. Only exact confirmed, tenant-owned records can influence policy.
 const citations:Citation[]=result.results.flatMap(item=>{
  const job=jobs.find(j=>j.blobId===item.blob_id&&j.text===item.text&&j.policyId);
  return job?[{id:job.id,blobId:item.blob_id,text:item.text,policyId:job.policyId!,distance:item.distance}]:[];
 });
 await d.insert(s.memoryRecallEvents).values({tenantId,invoiceId,query,memoryIds:citations.map(c=>c.id),status:citations.length?'recalled':'no_matches'});
 return {citations,status:citations.length?`Recalled ${citations.length} confirmed Mainnet memories`:'No matching confirmed memories returned. Indexing/relevance may delay recall; retry without rewriting.',dropped:result.dropped_count||0};
}
export async function assess(tenantId:string,invoiceId:string,memoryOn:boolean) {
 const invoice=await ownedInvoice(tenantId,invoiceId); const [history,prefs,rules]=await Promise.all([listInvoices(tenantId),preferences(tenantId),policies(tenantId)]);
 let citations:Citation[]=[]; let status='Off: learned soft policies excluded; mandatory user rules remain active';
 if(memoryOn) {
  try { const recalled=await recallMemories(tenantId,`Payment review for ${vendorReference(tenantId,invoice.vendorId)}. Changed or new recipient address, duplicate billing, manual approval threshold and confirmed exceptions.`,invoice.id); citations=recalled.citations; status=recalled.status; }
  catch(error) { status=safeError(error); await audit(tenantId,'memory.recall_unavailable',invoice.id,{status}); }
 }
 const assessment=evaluate(invoice,history,prefs,rules,citations,status);
 await (await db()).insert(s.riskFindings).values({tenantId,invoiceId,memoryOn,assessment,findings:assessment.findings});
 await audit(tenantId,'review.evaluated',invoiceId,{level:assessment.level,memoryOn,usedMemoryIds:assessment.citations.map(c=>c.id),findingIds:assessment.findings.map(f=>f.id)});
 return assessment;
}
export async function prepareSeed(tenantId:string) {
 if(!memoryConfigured()) unavailable('Walrus Mainnet');
 await seedDemo(tenantId); const invoices=await listInvoices(tenantId); const names=['Northstar Studio','Orbit Hosting','Forma Legal','Lumen Research'];
 const d=await db();
 // Each event has a durable operation key. HTTP resume processes one job at a time.
 for(const [index,event] of seedEvents.entries()) {
  const key=`seed-v1-${index}`;
  const [existing]=await d.select().from(s.memoryJobs).where(and(eq(s.memoryJobs.tenantId,tenantId),eq(s.memoryJobs.operationKey,key)));
  if(existing) continue;
  const invoice=invoices.find(i=>i.isDemo&&i.vendor===names[event.vendor])!;
  const policy:Policy={id:randomUUID(),vendorId:invoice.vendorId,kind:event.kind,value:'value' in event?event.value:undefined,text:event.text,hard:false,scope:'vendor',active:true};
  await d.transaction(async tx=>{
   await tx.insert(s.userRules).values({id:policy.id,tenantId,vendorId:invoice.vendorId,policy});
   await tx.insert(s.memoryJobs).values({tenantId,invoiceId:invoice.id,policyId:policy.id,operationKey:key,namespace:namespaceFor(tenantId),intent:`Synthetic business event ${index+1}`,text:minimizedMemory(tenantId,policy,true),accountId:process.env.MEMWAL_ACCOUNT_ID,isDemo:true});
   await tx.insert(s.auditEvents).values({tenantId,type:'memory.seed_requested',entityId:policy.id,detail:{event:index+1,synthetic:true}});
  });
 }
 return (await d.select().from(s.memoryJobs).where(eq(s.memoryJobs.tenantId,tenantId))).filter(j=>j.operationKey.startsWith('seed-v1-'));
}
