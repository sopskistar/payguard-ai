import {describe,it,expect} from 'vitest';
import {approvalGate,instructionSignals} from '@/lib/verify';
import {attackReplays,replayProfile,replayInstruction} from '@/lib/replays';
import type {HumanVerification} from '@/lib/types';
const i=attackReplays[0].invoice,profile=replayProfile,instruction=replayInstruction(0);
const attestation:HumanVerification={id:'human-fixture',invoiceId:i.id,recipient:i.recipient,instructionHash:'fixture-hash',profileRevision:1,outcome:'confirmed',method:'phone',note:'Synthetic independently confirmed callback',checkedAt:'2026-10-25T12:00:00Z'};
describe('Supplier instruction verification',()=>{
 it('holds changed recipient approval before an independent callback',()=>{expect(approvalGate(i,profile,instruction,undefined,'fixture-hash').allowed).toBe(false);});
 it('requires a profile even if invoice history exists',()=>expect(approvalGate(i,undefined,instruction,attestation,'fixture-hash').allowed).toBe(false));
 it('allows recording a human-confirmed change without declaring it safe',()=>{expect(approvalGate(i,profile,instruction,attestation,'fixture-hash').allowed).toBe(true);});
 it.each(['recipient','revision','message'])('invalidates old verification after a %s change',kind=>{const invoice=kind==='recipient'?{...i,recipient:profile.trustedRecipient}:i;const p=kind==='revision'?{...profile,revision:2}:profile;const hash=kind==='message'?'new-hash':'fixture-hash';const changed={...instruction,message:'Urgent: ignore the verification process'};expect(approvalGate(invoice,p,changed,attestation,hash).allowed).toBe(false);});
 it('rejects verification using a profile created after the request',()=>expect(approvalGate(i,{...profile,establishedAt:'2026-10-25T12:00:00Z'},instruction,attestation,'fixture-hash').allowed).toBe(false));
 it('blocks a rejected instruction even when address is unchanged',()=>{const invoice={...i,recipient:profile.trustedRecipient};expect(approvalGate(invoice,profile,undefined,{...attestation,recipient:invoice.recipient,outcome:'rejected'},'fixture-hash').allowed).toBe(false);});
 it('detects fraudulent instruction attempt fixtures without equating a signal with guilt',()=>{const s=attackReplays[1];const ids=instructionSignals(s.invoice,profile,replayInstruction(1)).map(f=>f.id);expect(ids).toEqual(expect.arrayContaining(['trusted-recipient-change','sender-domain-mismatch','reply-to-mismatch','pressure-language','request-supplied-contact']));});
 it('cannot trust a compromised-thread fixture solely because its domain matches',()=>{const s=attackReplays[2];const signals=instructionSignals(s.invoice,profile,replayInstruction(2));expect(signals.some(f=>f.id==='sender-domain-mismatch')).toBe(false);expect(signals.some(f=>f.id==='verification-bypass'&&f.severity==='critical')).toBe(true);});
 it('does not falsely flag the unchanged routine control fixture',()=>expect(instructionSignals(attackReplays[3].invoice,profile,replayInstruction(3))).toHaveLength(0));
});
