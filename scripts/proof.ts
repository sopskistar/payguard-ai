import {config} from 'dotenv';
import {writeFile,mkdir} from 'node:fs/promises';
import {eq,and} from 'drizzle-orm';
config({path:'.env.local',quiet:true});
async function main(){
 if(!process.env.DATABASE_URL)throw new Error('Neon required');
 const {db}=await import('../src/db/index');const s=await import('../src/db/schema');const {OWNER_ID}=await import('../src/lib/demo');const d=await db();
 const jobs=await d.select().from(s.memoryJobs).where(and(eq(s.memoryJobs.tenantId,OWNER_ID),eq(s.memoryJobs.status,'confirmed')));
 const matches=await d.select().from(s.paymentMatches).where(eq(s.paymentMatches.tenantId,OWNER_ID));
 const recalls=await d.select().from(s.memoryRecallEvents).where(eq(s.memoryRecallEvents.tenantId,OWNER_ID));
 const events=await d.select().from(s.auditEvents).where(eq(s.auditEvents.tenantId,OWNER_ID));
 const evidence={exportedAt:new Date().toISOString(),source:'Neon records; completion evidence returned by Walrus SDK',memoryAccountId:process.env.MEMWAL_ACCOUNT_ID||null,delegatePublicIdentity:process.env.MEMWAL_AGENT_ID||null,confirmedMemories:jobs.filter(j=>j.blobId&&j.jobId&&j.namespace.startsWith('payguard-v1-')).map(j=>({id:j.id,jobId:j.jobId,blobId:j.blobId,accountId:j.accountId,namespace:j.namespace,completedAt:j.completedAt,isSyntheticBusinessEvent:j.isDemo})),recalls:recalls.map(r=>({id:r.id,memoryIds:r.memoryIds,status:r.status,at:r.createdAt})),decisions:events.filter(e=>e.type==='review.evaluated').map(e=>({id:e.id,detail:e.detail,at:e.createdAt})),payments:matches.map(m=>({digest:m.digest,network:m.network,verifiedAt:m.createdAt})),tatumHealth:events.filter(e=>e.type==='integration.health').map(e=>({at:e.createdAt,tatum:e.detail.tatum}))};
 await mkdir('.data',{recursive:true});await writeFile('.data/mainnet-proof.json',JSON.stringify(evidence,null,2)+'\n');console.log(`Exported ${evidence.confirmedMemories.length} completed memory records to .data/mainnet-proof.json (gitignored). Review identifiers before publishing. No proof was invented.`);process.exit(0);
}
main().catch(()=>{console.error('Proof export blocked. Configure Neon and apply migrations. No proof file was claimed.');process.exit(1);});
