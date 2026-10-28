'use client';
import { useState } from 'react';
import Link from 'next/link';
import { motion, MotionConfig } from 'motion/react';
import { ArrowRight, ShieldCheck, BrainCircuit, RotateCcw, Check, LockKeyhole } from 'lucide-react';
import recorded from '../../docs/evidence/judge-recall.json';
import memories from '../../docs/evidence/walrus-confirmed.json';
import chain from '../../docs/evidence/tatum-reconciliation.json';
import { judgeReview, JUDGE_HASH } from '@/lib/judge';
import type { HumanVerification, Policy } from '@/lib/types';
import { Badge, FindingList } from './ui';
const steps = [
  'Open the invoice',
  'Find the switch',
  'Enforce the hold',
  'Verify independently',
  'Recall the policy',
  'Inspect the chain',
  'Audit the decision',
];
export function JudgeSandbox() {
  const [step, setStep] = useState(0),
    [on, setOn] = useState(false),
    [attested, setAttested] = useState(false),
    [edited, setEdited] = useState(false),
    [attempted, setAttempted] = useState(false),
    [decision, setDecision] = useState(''),
    [events, setEvents] = useState<string[]>(['Opened a synthetic invoice.']);
  const verification: HumanVerification | undefined = attested
    ? {
        id: 'judge-synthetic-attestation',
        invoiceId: 'b0000000-0000-4000-8000-000000000001',
        recipient: '0x' + '2'.repeat(64),
        profileRevision: 1,
        instructionHash: JUDGE_HASH,
        outcome: 'confirmed',
        method: 'phone',
        note: 'Synthetic practice: independent established contact confirmed this exact sample instruction.',
        checkedAt: new Date().toISOString(),
      }
    : undefined;
  const review = judgeReview(
    on,
    recorded.policies as Policy[],
    recorded.citations,
    verification,
    edited,
  );
  const off = judgeReview(false, recorded.policies as Policy[], recorded.citations);
  const learned = judgeReview(true, recorded.policies as Policy[], recorded.citations);
  const log = (event: string) => setEvents((e) => [...e, event]);
  function next() {
    setStep((s) => Math.min(6, s + 1));
  }
  function reset() {
    setStep(0);
    setOn(false);
    setAttested(false);
    setEdited(false);
    setAttempted(false);
    setDecision('');
    setEvents(['Reset local synthetic practice. Published Mainnet proof unchanged.']);
  }
  return (
    <MotionConfig reducedMotion="user">
      <div className="judge-shell">
        <header className="judge-header">
          <Link href="/" className="sidebar-brand">
            <img src="/brand/icon.png" alt="PayGuard shield" />
            <span>
              PayGuard <span>Verify</span>
            </span>
          </Link>
          <nav>
            <Link href="/app/replay">Attack Replay Lab</Link>
            <a
              href="https://github.com/sopskistar/payguard-ai/blob/main/docs/MAINNET_PROOF.md"
              target="_blank"
              rel="noreferrer"
            >
              Mainnet proof ↗
            </a>
          </nav>
        </header>
        <main id="main">
          <div className="judge-intro">
            <span className="eyebrow mint-text">JUDGE SANDBOX · ABOUT THREE MINUTES</span>
            <h1>
              A familiar invoice.
              <br />A different recipient.
            </h1>
            <p>Follow the switch, enforce a hold, and see what PayGuard remembers.</p>
            <div className="notice">
              <LockKeyhole size={18} />
              <span>
                No account, funding or wallet needed. Business events and the callback are synthetic
                practice. Walrus and Tatum receipts are genuine, dated evidence from completed
                tests. This sandbox makes no private writes or live provider calls.
              </span>
            </div>
          </div>
          <ol className="judge-progress" aria-label="Walkthrough steps">
            {steps.map((title, i) => (
              <li key={title}>
                <button aria-current={step === i ? 'step' : undefined} onClick={() => setStep(i)}>
                  <span>{i + 1}</span>
                  {title}
                </button>
              </li>
            ))}
          </ol>
          <motion.section
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="panel judge-stage"
          >
            <div className="panel-top">
              <Badge>Step {step + 1} / 7</Badge>
              <Badge tone="amber">Synthetic business scenario</Badge>
            </div>
            <h2>{steps[step]}</h2>
            {step === 0 && (
              <>
                <p>
                  Northstar Studio’s monthly design retainer looks familiar. Open it as a reviewer
                  before deciding.
                </p>
                <dl className="detail-list">
                  <div>
                    <dt>Invoice</dt>
                    <dd>NS-1048</dd>
                  </div>
                  <div>
                    <dt>Amount</dt>
                    <dd>$1,250 USD</dd>
                  </div>
                  <div>
                    <dt>Agreed tokens</dt>
                    <dd>500 SUI — synthetic agreement, no implied conversion</dd>
                  </div>
                </dl>
                <blockquote className="instruction-quote">
                  Please use our new wallet for this familiar retainer.
                </blockquote>
                <button
                  className="button primary"
                  onClick={() => {
                    log('Opened established supplier reference.');
                    next();
                  }}
                >
                  Open supplier reference <ArrowRight size={16} />
                </button>
              </>
            )}
            {step === 1 && (
              <>
                <p>
                  The exact address comparison matters even when the amount and invoice design are
                  unchanged.
                </p>
                <div className="recipient-comparison">
                  <div>
                    <span className="eyebrow">ESTABLISHED RECIPIENT</span>
                    <code>{review.profile.trustedRecipient}</code>
                  </div>
                  <ArrowRight />
                  <div>
                    <span className="eyebrow">PROPOSED RECIPIENT</span>
                    <code>{review.invoice.recipient}</code>
                    <Badge tone="danger">Changed</Badge>
                  </div>
                </div>
                <p>
                  Established channel: a previously recorded supplier phone contact. A number
                  embedded in the new invoice is not an independent trust anchor.
                </p>
                <button className="button primary" onClick={next}>
                  Check approval protection <ArrowRight size={16} />
                </button>
              </>
            )}
            {step === 2 && (
              <>
                <div className="comparison-grid">
                  <div>
                    <h3>Vulnerable procedure</h3>
                    <p>
                      Illustrative failure: accepting the familiar document without checking its
                      recipient could send funds to the changed address. This is a hypothetical
                      procedure, not an enabled app mode.
                    </p>
                  </div>
                  <div>
                    <h3>PayGuard’s actual gate</h3>
                    <p role="status">{review.gate.reason}</p>
                    <Badge tone={review.gate.allowed ? 'mint' : 'danger'}>
                      {review.gate.allowed ? 'Human review eligible' : 'Approval held'}
                    </Badge>
                  </div>
                </div>
                <button
                  className="button outline"
                  onClick={() => {
                    setAttempted(true);
                    log(
                      review.gate.allowed
                        ? 'Practice review eligible after exact attestation.'
                        : 'Approval attempt blocked: independent verification missing.',
                    );
                  }}
                >
                  Try approving this invoice
                </button>
                {attempted && (
                  <p className="notice">
                    {review.gate.allowed
                      ? 'An exact current human attestation permits a review decision.'
                      : 'Blocked by the same approvalGate function used by the protected owner API.'}
                  </p>
                )}
                <button className="button primary" onClick={next}>
                  Use the independent channel <ArrowRight size={16} />
                </button>
              </>
            )}
            {step === 3 && (
              <>
                <p>
                  In production the reviewer contacts the supplier through the pre-established
                  channel. Here, record an explicitly synthetic practice attestation.
                </p>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={attested}
                    onChange={(e) => {
                      setAttested(e.target.checked);
                      log(
                        e.target.checked
                          ? 'Synthetic independent verification recorded for exact original terms.'
                          : 'Practice attestation removed.',
                      );
                    }}
                  />
                  Practice only: the established supplier contact confirmed these exact
                  instructions.
                </label>
                <p>
                  Attestation scope: this invoice and instruction hash, profile revision 1; expires
                  after 30 days. PayGuard does not place or observe the call.
                </p>
                <button
                  className="button outline"
                  onClick={() => {
                    setEdited((e) => !e);
                    log('Instruction edited; old attestation cannot cover new terms.');
                  }}
                >
                  {edited
                    ? 'Restore original instructions'
                    : 'Edit instructions after verification'}
                </button>
                <p role="status">{review.gate.reason}</p>
                {edited && (
                  <blockquote className="instruction-quote">
                    {review.instruction.message}{' '}
                    <strong>Embedded directives are inert data.</strong>
                  </blockquote>
                )}
                <button className="button primary" onClick={next}>
                  Compare memory OFF / ON <BrainCircuit size={16} />
                </button>
              </>
            )}
            {step === 4 && (
              <>
                <p>
                  Actual semantic recall captured {new Date(recorded.capturedAt).toLocaleString()}.
                  The following comparison replays those confirmed, applicable policies through the
                  real deterministic engine. It does not pretend to query Walrus on every click.
                </p>
                <div className="segmented">
                  <button
                    aria-pressed={!on}
                    className={!on ? 'active' : ''}
                    onClick={() => {
                      setOn(false);
                      log('Memory OFF: baseline retained.');
                    }}
                  >
                    Memory OFF
                  </button>
                  <button
                    aria-pressed={on}
                    className={on ? 'active mint-active' : ''}
                    onClick={() => {
                      setOn(true);
                      log('Recorded Walrus citations applied to this synthetic vendor.');
                    }}
                  >
                    Memory ON
                  </button>
                </div>
                <div className="comparison-grid">
                  <div>
                    <h3>Before memory</h3>
                    <Badge tone="amber">{off.assessment.level}</Badge>
                    <p>Recipient-change checks remain active.</p>
                  </div>
                  <div>
                    <h3>After actual recall</h3>
                    <Badge tone="danger">{learned.assessment.level}</Badge>
                    <p>
                      {learned.assessment.citations.length} applicable citations add the remembered
                      escalation procedure.
                    </p>
                  </div>
                </div>
                <FindingList assessment={review.assessment} />
                {on &&
                  review.assessment.citations.map((c) => (
                    <div className="notice" key={c.id}>
                      <BrainCircuit size={18} />
                      <div>
                        <strong>Actual recalled Mainnet blob</strong>
                        <code>{c.blobId}</code>
                        <p>{recorded.policies.find((p) => p.id === c.policyId)?.text}</p>
                      </div>
                    </div>
                  ))}
                <p>
                  {memories.confirmedMemories.length} published confirmed records.{' '}
                  <a
                    className="inline-link"
                    href="https://github.com/sopskistar/payguard-ai/blob/main/docs/evidence/judge-recall.json"
                  >
                    Inspect raw recorded recall ↗
                  </a>
                </p>
                <button className="button primary" onClick={next}>
                  Inspect real Tatum evidence <ArrowRight size={16} />
                </button>
              </>
            )}
            {step === 5 && (
              <>
                <Badge tone="cyan">
                  Real Sui Mainnet transaction · recorded Tatum gRPC evidence
                </Badge>
                <p>
                  The transaction executed successfully. It did not pay the synthetic supplier.
                  PayGuard compares the exact recipient credit, token and amount rather than
                  treating success as a receipt.
                </p>
                <code>{chain.digest}</code>
                <dl className="detail-list">
                  <div>
                    <dt>Finalized checkpoint</dt>
                    <dd>{chain.transaction.checkpoint}</dd>
                  </div>
                  <div>
                    <dt>Expected sample credit</dt>
                    <dd>{chain.expectedAtomic} atomic units</dd>
                  </div>
                  <div>
                    <dt>Actual recipient credit</dt>
                    <dd>{chain.receivedAtomic} atomic units</dd>
                  </div>
                  <div>
                    <dt>Reconciliation</dt>
                    <dd>
                      <Badge tone="danger">{chain.status}</Badge>
                    </dd>
                  </div>
                </dl>
                <a className="inline-link" href={chain.explorer} target="_blank" rel="noreferrer">
                  Inspect on SuiScan ↗
                </a>
                <button
                  className="button primary"
                  onClick={() => {
                    log('Tatum evidence rejected as a sample invoice match; no payment recorded.');
                    next();
                  }}
                >
                  Record the final review <ArrowRight size={16} />
                </button>
              </>
            )}
            {step === 6 && (
              <>
                <p>
                  Review approval and proof of payment are separate. This practice audit stays in
                  your browser component; the owner workflow persists its decisions in Neon.
                </p>
                <div className="review-actions">
                  <button
                    className="button primary"
                    onClick={() => {
                      const d = review.gate.allowed
                        ? 'Human review approved for exact attested instructions; payment remains unverified.'
                        : 'Approval blocked; request independent verification.';
                      setDecision(d);
                      log(d);
                    }}
                  >
                    <ShieldCheck size={17} /> Record review decision
                  </button>
                  <button
                    className="button outline"
                    onClick={() => {
                      setDecision('Escalated to a human reviewer.');
                      log('Escalated to a human reviewer.');
                    }}
                  >
                    Escalate instead
                  </button>
                </div>
                {decision && (
                  <p role="status" className="notice">
                    {decision}
                  </p>
                )}
                <ol className="judge-audit">
                  {events.map((e, i) => (
                    <li key={i}>
                      <Check size={14} />
                      <span>{e}</span>
                    </li>
                  ))}
                </ol>
                <Link className="button primary" href="/app/replay">
                  Explore the full application <ArrowRight size={16} />
                </Link>
              </>
            )}
          </motion.section>
          <footer className="judge-footer">
            <button className="button outline" onClick={reset}>
              <RotateCcw size={15} /> Reset practice
            </button>
            <a href="https://github.com/sopskistar/payguard-ai/blob/main/docs/JUDGE_WALKTHROUGH.md">
              Detailed walkthrough ↗
            </a>
            <a href="https://sopskistar.github.io/payguard-ai/">Technical article ↗</a>
          </footer>
        </main>
      </div>
    </MotionConfig>
  );
}
