import { DEFAULT_PREFERENCES, type Invoice, type Snapshot } from './types';
import { evaluate } from './risk';
export const OWNER_ID = 'a0000000-0000-4000-8000-000000000001';
export const sampleAddress = '0x'+'1'.repeat(64);
export const changedAddress = '0x'+'2'.repeat(64);
export function demoInvoices(): Invoice[] {
 const rows: [string,string,string,string,string,string,Invoice['status'],string][] = [
 ['Northstar Studio','NS-1048','2026-10-24','2026-10-31','1250','USD','open',changedAddress],
 ['Northstar Studio','NS-1046','2026-09-24','2026-09-30','1250','USD','approved',sampleAddress],
 ['Northstar Studio','NS-1045','2026-08-24','2026-08-31','1200','USD','approved',sampleAddress],
 ['Orbit Hosting','OH-209','2026-10-23','2026-10-30','89','USD','open',''],
 ['Orbit Hosting','OH-209','2026-10-24','2026-10-30','89','USD','open',''],
 ['Forma Legal','FL-082','2026-10-21','2026-10-25','3400','USD','open',''],
 ['Lumen Research','LR-017','2026-10-25','2026-11-05','480','USD','open',''],
 ['Orbit Hosting','OH-210','2026-10-25','2026-11-01','89','USD','open','']
 ];
 const vendors=['Northstar Studio','Orbit Hosting','Forma Legal','Lumen Research'];
 return rows.map((r,i)=>({id:`b0000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`, vendorId:`c0000000-0000-4000-8000-${String(vendors.indexOf(r[0])+1).padStart(12,'0')}`,vendor:r[0],number:r[1],issued:r[2],due:r[3],amount:r[4],currency:r[5],status:r[6],recipient:r[7],memo:'Synthetic invoice for the guided PayGuard demo.', wallet:'',coinType:r[7]?'0x2::sui::SUI':'',tokenAmount:r[7]?'500':'',source:'manual',isDemo:true,createdAt:r[2]+'T12:00:00.000Z'}));
}
export function publicSnapshot(): Snapshot {
 const invoices=demoInvoices();
 return {mode:'public-demo',storage:'Read-only sample dataset', invoices, assessments:Object.fromEntries(invoices.map(i=>[i.id,evaluate(i,invoices,DEFAULT_PREFERENCES,[],[],'Public demo: live recall requires owner login',new Date('2026-10-26T12:00:00Z'))])),memories:[],wallets:[],audit:[],preferences:DEFAULT_PREFERENCES,integrations:{database:false,memory:false,tatum:false},confirmedPayments:0,usedMemoryIds:[]};
}
export const seedEvents = [
 { vendor:0,kind:'verify_address',text:'Always independently verify a changed payout address for this vendor.' },
 { vendor:1,kind:'duplicate',text:'A repeated invoice number was rejected; compare the service period on future duplicates.' },
 { vendor:0,kind:'exception',text:'The recurring design retainer has an approved quarterly scope exception; still review address changes.' },
 { vendor:2,kind:'threshold',text:'Legal invoices above 2500 require an additional human review.',value:'2500' },
 { vendor:3,kind:'verify_address',text:'New research vendor addresses require an independent callback before payment.' },
 { vendor:1,kind:'exception',text:'Two hosting charges may refer to distinct projects; check line items before dismissing possible duplicates.' },
 { vendor:0,kind:'escalate',text:'An unexplained recipient change was escalated previously; escalate future matching changes.' },
 { vendor:2,kind:'duplicate',text:'A legal retainer rebill must cite the canceled invoice before approval.' },
 { vendor:3,kind:'threshold',text:'Research expenses above 400 need manual signoff.',value:'400' },
 { vendor:1,kind:'verify_address',text:'A hosting payout-address change requires verification outside the invoice email thread.' },
 { vendor:2,kind:'exception',text:'A rush legal consultation was a one-time exception; do not infer blanket approval.' },
 { vendor:3,kind:'escalate',text:'Escalate repeated billing or recipient mismatches for research engagements.' },
] as const;
