import {config} from 'dotenv';
import {mkdir,writeFile} from 'node:fs/promises';
config({path:'.env.local',quiet:true});
async function main(){
 const {chainHealth,inspectTransaction,inspectLatestTransaction}=await import('../src/lib/integrations/tatum');
 const {memoryConfigured,memoryClient}=await import('../src/lib/integrations/memory');const {OWNER_ID}=await import('../src/lib/demo');
 const {safeError}=await import('../src/lib/errors');const report:Record<string,unknown>={checkedAt:new Date().toISOString(),writesAttempted:false};
 for(const [name,operation] of Object.entries({tatum:()=>chainHealth(),walrus:()=>memoryConfigured()?memoryClient(OWNER_ID).health():Promise.reject(new Error('not configured'))})){
  try{report[name]={status:'connected',evidence:await operation()};}catch(e){report[name]={status:'unavailable',detail:safeError(e)};}
 }
 if(process.env.TATUM_API_KEY){try{report.transaction=process.env.TATUM_TEST_DIGEST?await inspectTransaction(process.env.TATUM_TEST_DIGEST):await inspectLatestTransaction();}catch(e){report.transaction={status:'unverified',detail:safeError(e)};}}
 await mkdir('.data',{recursive:true});await writeFile('.data/live-diagnostics.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 const ok=(report.tatum as {status:string}).status==='connected'&&(report.walrus as {status:string}).status==='connected';process.exit(ok?0:2);
}
main().catch(()=>{console.error('Live diagnostics failed without exposing provider internals.');process.exit(1);});
