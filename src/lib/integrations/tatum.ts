import 'server-only';
import { z } from 'zod';
import { address, canonicalCoin, digestSchema, units } from '../validation';
import type { Invoice } from '../types';
import { AppError, unavailable } from '../errors';
export const TATUM_URL = 'https://sui-mainnet.gateway.tatum.io';
export const MAINNET_CHAIN_ID = '35834a8a';
const balanceChange = z.object({ owner: z.union([z.object({AddressOwner:z.string()}),z.object({ObjectOwner:z.string()}),z.string()]),coinType:z.string(),amount:z.string().regex(/^-?\d+$/) });
export const transactionSchema = z.object({ digest:digestSchema, effects:z.object({status:z.object({status:z.string(),error:z.string().optional()}),gasObject:z.object({owner:z.unknown()}).optional()}).optional(), balanceChanges:z.array(balanceChange).optional(), transaction:z.object({data:z.object({sender:z.string(),gasData:z.object({owner:z.string()}).optional()})}).optional(), timestampMs:z.string().optional(),checkpoint:z.string().optional(), errors:z.array(z.string()).optional() });
export type ChainTransaction = z.infer<typeof transactionSchema>;
export type Verification = { status:'Confirmed match'|'Mismatch'|'Needs review'|'Unverified'|'Conflict';digest:string;network:string;chainId:string;criteria:{label:string;passed:boolean|null;detail:string}[];transaction:ChainTransaction;decimals:number|null;expectedAtomic:string|null;receivedAtomic:string;explorer:string;checkedAt:string };
export async function rpc<T>(method:string, params:unknown[], schema:z.ZodType<T>):Promise<T> {
 if(!process.env.TATUM_API_KEY) unavailable('Tatum');
 for(let attempt=0;attempt<3;attempt++) {
  let response:Response;
  try { response=await fetch(TATUM_URL,{method:'POST',headers:{'content-type':'application/json','x-api-key':process.env.TATUM_API_KEY},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(12000),cache:'no-store'}); }
  catch { throw new AppError(502,'RPC_OFFLINE','Tatum is unreachable or timed out. No chain result was verified.'); }
  if((response.status===429 || response.status>=500) && attempt<2) {
   const delay=Number(response.headers.get('retry-after') || 1);
   if(delay>4) throw new AppError(429,'RPC_RATE_LIMIT','Tatum requested a cooldown. Retry later; no result is verified.');
   await new Promise(r=>setTimeout(r,Math.max(1,delay)*1000*(attempt+1))); continue;
  }
  if(!response.ok) throw new AppError(502,'RPC_HTTP',`Tatum returned HTTP ${response.status}. Check API key, quota and Sui Mainnet access.`);
  const envelope=z.object({jsonrpc:z.literal('2.0'),id:z.literal(1),result:z.unknown().optional(),error:z.object({code:z.number(),message:z.string()}).optional()}).safeParse(await response.json());
  if(!envelope.success || envelope.data.error) throw new AppError(502,'RPC_REJECTED',`Tatum rejected ${method} or returned an invalid response. Method availability may have changed.`);
  const result=schema.safeParse(envelope.data.result);
  if(!result.success) throw new AppError(502,'RPC_SCHEMA','Tatum response was incomplete or changed shape; verification stopped.');
  return result.data;
 }
 throw new AppError(502,'RPC_OFFLINE','Tatum is unavailable.');
}
export async function chainHealth() {
 const chainId=await rpc('sui_getChainIdentifier',[],z.string());
 if(chainId!==MAINNET_CHAIN_ID) throw new AppError(502,'WRONG_NETWORK','Provider did not identify Sui Mainnet. Verification stopped.');
 return {chainId,network:'Sui Mainnet',endpoint:TATUM_URL,checkedAt:new Date().toISOString()};
}
export async function inspectTransaction(digest:string) {
 digestSchema.parse(digest); const health=await chainHealth();
 const transaction=await rpc('sui_getTransactionBlock',[digest,{showInput:true,showEffects:true,showBalanceChanges:true}],transactionSchema);
 if(transaction.digest!==digest) throw new AppError(502,'DIGEST_MISMATCH','Provider returned a different transaction digest.');
 return { ...health, transaction, explorer:`https://suiscan.xyz/mainnet/tx/${digest}` };
}
export function reconcile(invoice:Invoice, tx:ChainTransaction, decimals:number|null, chainId:string, claimed=false):Verification {
 const criteria:Verification['criteria']=[];
 const add=(label:string,passed:boolean|null,detail:string)=>criteria.push({label,passed,detail});
 add('Sui Mainnet',chainId===MAINNET_CHAIN_ID,chainId);
 add('Successful execution',tx.effects ? tx.effects.status.status==='success' : null,tx.effects?.status.status || 'Effects unavailable');
 add('Complete balance evidence',tx.balanceChanges && !tx.errors?.length ? true:null,tx.errors?.length?'Provider returned partial data':'Balance changes requested from chain');
 const recipient=invoice.recipient.toLowerCase();
 const sender=tx.transaction?.data.sender.toLowerCase();
 const gasOwner=tx.transaction?.data.gasData?.owner.toLowerCase();
 add('Intended recipient',recipient?true:null,recipient||'Recipient missing');
 add('Recipient is distinct from sender and gas payer',!recipient||!sender||!gasOwner?null:recipient!==sender&&recipient!==gasOwner,'Sender/gas-payer net changes can include rebates and are not accepted as payment evidence.');
 add('Agreed coin and amount',invoice.coinType&&invoice.tokenAmount?true:null,invoice.tokenAmount?`${invoice.tokenAmount} ${invoice.coinType}`:'Set the agreed token amount. No fiat/token conversion is assumed.');
 add('Coin decimals',decimals!==null?true:null,decimals===null?'Coin metadata unavailable':String(decimals));
 let expected:bigint|null=null;
 if(invoice.tokenAmount&&decimals!==null) { try { expected=units(invoice.tokenAmount,decimals); } catch { add('Token precision',false,'Agreed amount cannot be represented in this token.'); } }
 const received=(tx.balanceChanges||[]).filter(c=>typeof c.owner==='object'&&'AddressOwner' in c.owner&&c.owner.AddressOwner.toLowerCase()===recipient&&canonicalCoin(c.coinType)===canonicalCoin(invoice.coinType)).reduce((n,c)=>n+BigInt(c.amount),0n);
 add('Exact positive recipient credit',expected===null||!tx.balanceChanges?null:received>0n&&received===expected,`Received ${received.toString()} atomic units; expected ${expected?.toString()??'unknown'}. Over/underpayments require review.`);
 add('Unique invoice match',!claimed,claimed?'Digest is already assigned to another invoice.':'Uniqueness is enforced again when saving.');
 const status=claimed?'Conflict':criteria.some(c=>c.passed===null)?'Needs review':criteria.some(c=>c.passed===false)?'Mismatch':'Confirmed match';
 return {status,digest:tx.digest,network:'Sui Mainnet',chainId,criteria,transaction:tx,decimals,expectedAtomic:expected?.toString()??null,receivedAtomic:received.toString(),explorer:`https://suiscan.xyz/mainnet/tx/${tx.digest}`,checkedAt:new Date().toISOString()};
}
export async function verifyInvoice(invoice:Invoice,digest:string,claimed=false) {
 const inspection=await inspectTransaction(digest); let decimals:number|null=null;
 if(invoice.coinType) { const meta=await rpc('suix_getCoinMetadata',[invoice.coinType],z.object({decimals:z.number().int().min(0).max(38),symbol:z.string()}).nullable()); decimals=meta?.decimals??null; }
 return reconcile(invoice,inspection.transaction,decimals,inspection.chainId,claimed);
}
export async function watchWallet(owner:string,cursor:string|null=null,direction:'incoming'|'outgoing'='incoming') {
 address.parse(owner); if(cursor) digestSchema.parse(cursor); const health=await chainHealth();
 const [balance,transactions]=await Promise.all([
  rpc('suix_getBalance',[owner,'0x2::sui::SUI'],z.object({coinType:z.string(),totalBalance:z.string().regex(/^\d+$/)})),
  rpc('suix_queryTransactionBlocks',[{filter:direction==='incoming'?{ToAddress:owner}:{FromAddress:owner},options:{showInput:true,showEffects:true,showBalanceChanges:true}},cursor,20,true],z.object({data:z.array(transactionSchema),nextCursor:z.string().nullable(),hasNextPage:z.boolean()}))
 ]);
 return {...health,balance,transactions,direction};
}
