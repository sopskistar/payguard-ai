'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { motion, MotionConfig } from 'motion/react';
import {
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  BrainCircuit,
  RotateCcw,
  Check,
  LockKeyhole,
  Phone,
  ExternalLink,
} from 'lucide-react';
import recorded from '../../docs/evidence/judge-recall.json';
import memories from '../../docs/evidence/walrus-confirmed.json';
import chain from '../../docs/evidence/tatum-reconciliation.json';
import { judgeReview, JUDGE_HASH } from '@/lib/judge';
import type { HumanVerification, Policy } from '@/lib/types';
import { Badge, FindingList } from './ui';
import { useClientReady } from './client-ready';
const steps = [
  {
    title: 'Meet the invoice',
    task: 'Read the familiar supplier invoice. Notice that the document looks ordinary.',
    next: 'Compare the recipient',
    explain:
      'The supplier, invoice and amounts in this walkthrough are synthetic. No payment is being requested.',
  },
  {
    title: 'Spot the changed recipient',
    task: 'Compare the established wallet with the recipient on the new invoice.',
    next: 'Test the approval hold',
    explain:
      'A wallet address tells you where value would go. It does not tell you whether the supplier authorized it.',
  },
  {
    title: 'Try the approval hold',
    task: 'Try approving the changed instruction before independently verifying it.',
    next: 'Verify independently',
    explain:
      'This uses the same approval rule as the protected application API. Familiar wording cannot remove the hold.',
  },
  {
    title: 'Verify through a known contact',
    task: 'Record a practice confirmation, then try changing the instructions.',
    next: 'See what was remembered',
    explain:
      'Use the supplier contact established before this request—not a number or link embedded in the invoice.',
  },
  {
    title: 'Remember the correction',
    task: 'Switch Memory ON to see the procedure added by genuine recorded recall.',
    next: 'Inspect the chain evidence',
    explain:
      'Walrus stores the approved rule. A later session retrieves it; hard verification checks remain active even when memory is off.',
  },
  {
    title: 'Check what actually moved',
    task: 'See why a successful real transaction is not a payment receipt for this invoice.',
    next: 'Record the review outcome',
    explain:
      'Tatum reads the transaction. PayGuard checks the exact recipient, token and amount independently of the supplier identity question.',
  },
  {
    title: 'Leave an auditable decision',
    task: 'Record a review decision or escalate, then finish the walkthrough.',
    next: 'Finish walkthrough',
    explain:
      'This practice log stays in this page. Real owner reviews save their decisions and evidence in Neon.',
  },
];
export function JudgeSandbox() {
  const ready = useClientReady();
  const [step, setStep] = useState(0),
    [on, setOn] = useState(false),
    [attestedAt, setAttestedAt] = useState<string>(),
    [expired, setExpired] = useState(false),
    [edited, setEdited] = useState(false),
    [attempted, setAttempted] = useState(false),
    [decision, setDecision] = useState(''),
    [complete, setComplete] = useState(false),
    [events, setEvents] = useState<string[]>(['Opened a synthetic supplier invoice.']);
  const stage = useRef<HTMLElement>(null);
  const verification: HumanVerification | undefined = attestedAt
    ? {
        id: 'judge-synthetic-attestation',
        invoiceId: 'b0000000-0000-4000-8000-000000000001',
        recipient: '0x' + '2'.repeat(64),
        profileRevision: 1,
        instructionHash: JUDGE_HASH,
        outcome: 'confirmed',
        method: 'phone',
        note: 'Synthetic practice confirmation through the established contact.',
        checkedAt: expired
          ? new Date(Date.parse(attestedAt) - 31 * 86400000).toISOString()
          : attestedAt,
      }
    : undefined;
  const review = judgeReview(
      on,
      recorded.policies as Policy[],
      recorded.citations,
      verification,
      edited,
    ),
    off = judgeReview(false, recorded.policies as Policy[], recorded.citations),
    learned = judgeReview(true, recorded.policies as Policy[], recorded.citations);
  const current = steps[step];
  const log = (event: string) => setEvents((e) => [...e, event]);
  function go(n: number) {
    setStep(n);
    requestAnimationFrame(() => {
      stage.current?.focus({ preventScroll: true });
      stage.current?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
    });
  }
  function reset() {
    setStep(0);
    setOn(false);
    setAttestedAt(undefined);
    setExpired(false);
    setEdited(false);
    setAttempted(false);
    setDecision('');
    setComplete(false);
    setEvents(['Reset local practice. Mainnet proof remains unchanged.']);
  }
  function invalidate() {
    setDecision('');
    setComplete(false);
  }
  return (
    <MotionConfig reducedMotion="user">
      {!ready && (
        <aside className="journey-loading" role="status">
          <p>Preparing the interactive walkthrough… Controls will unlock when ready.</p>
          <form action="/try" method="get">
            <button className="button outline" type="submit">
              Reload walkthrough
            </button>
          </form>
          <noscript>
            Enable JavaScript to use the guided practice. The proof links remain readable.
          </noscript>
        </aside>
      )}
      <fieldset className="journey journey-ready-controls" disabled={!ready}>
        <header className="journey-header">
          <Link href="/" className="journey-brand">
            <img src="/brand/icon.png" alt="PayGuard shield" />
            <span>
              PayGuard <b>Verify</b>
            </span>
          </Link>
          <div>
            <Link href="/proof">
              Mainnet proof <ExternalLink size={13} />
            </Link>
            <span className="journey-public">
              <LockKeyhole size={13} /> Public practice · no sign-in
            </span>
          </div>
        </header>
        <main id="main">
          <div className="journey-intro">
            <div>
              <span className="site-eyebrow">THE THREE-MINUTE INTERACTIVE DEMO</span>
              <h1>
                Follow the invoice.
                <br />
                <span>Catch the payment switch.</span>
              </h1>
            </div>
            <p>
              You play the reviewer. We’ll guide you from a changed recipient to a documented human
              decision.
            </p>
          </div>
          <div className="journey-modes">
            <span>
              <i /> Synthetic supplier & callback
            </span>
            <span>
              <i /> Genuine recorded Mainnet evidence
            </span>
            <details>
              <summary>What’s real here?</summary>
              <p>
                The business scenario is practice. Walrus job/blob IDs, captured semantic recall and
                Tatum transaction results are real, dated evidence. This public demo makes no
                provider calls, private writes or payments. Owner mode separately runs live
                operations behind sign-in.
              </p>
            </details>
          </div>
          <div className="journey-layout">
            <aside className="journey-sidebar">
              <div className="journey-progress-label">
                <strong>Step {step + 1} of 7</strong>
                <span>{Math.round(((step + 1) / 7) * 100)}%</span>
              </div>
              <div
                className="journey-track"
                role="progressbar"
                aria-label="Walkthrough progress"
                aria-valuenow={step + 1}
                aria-valuemin={1}
                aria-valuemax={7}
              >
                <span style={{ width: `${((step + 1) / 7) * 100}%` }} />
              </div>
              <ol aria-label="Walkthrough steps">
                {steps.map((s, i) => (
                  <li key={s.title}>
                    <button aria-current={step === i ? 'step' : undefined} onClick={() => go(i)}>
                      <span>{i + 1}</span>
                      {s.title}
                      {i < step && <Check size={13} />}
                    </button>
                  </li>
                ))}
              </ol>
              <button className="journey-reset" onClick={reset}>
                <RotateCcw size={14} /> Reset practice
              </button>
            </aside>
            <div className="journey-main">
              <motion.section
                ref={stage}
                tabIndex={-1}
                aria-labelledby="journey-step-title"
                key={step}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="journey-stage"
              >
                <div className="journey-stage-label">
                  <span>0{step + 1} / YOUR REVIEW</span>
                  <Badge tone={step === 4 || step === 5 ? 'cyan' : 'neutral'}>
                    {step === 4
                      ? 'Recorded Walrus recall'
                      : step === 5
                        ? 'Real Tatum evidence'
                        : 'Synthetic practice'}
                  </Badge>
                </div>
                <h2 id="journey-step-title">{current.title}</h2>
                <div className="journey-task">
                  <strong>Your task</strong>
                  <p>{current.task}</p>
                </div>
                {step === 0 && (
                  <>
                    <div className="journey-invoice">
                      <div>
                        <span className="site-monogram">N</span>
                        <div>
                          <h3>Northstar Studio</h3>
                          <p>Design retainer · NS-1048</p>
                        </div>
                        <strong>
                          $1,250<small>USD</small>
                        </strong>
                      </div>
                      <dl>
                        <div>
                          <dt>Invoice date</dt>
                          <dd>24 October 2026</dd>
                        </div>
                        <div>
                          <dt>Service</dt>
                          <dd>Monthly design retainer</dd>
                        </div>
                        <div>
                          <dt>Payment instruction</dt>
                          <dd>“Please use our new wallet.”</dd>
                        </div>
                      </dl>
                    </div>
                    <p className="journey-plain-note">
                      The name and amount are familiar. Before approving, check the destination—not
                      just the document.
                    </p>
                  </>
                )}
                {step === 1 && (
                  <>
                    <div className="journey-addresses">
                      <div>
                        <span>
                          <Check size={15} /> ESTABLISHED RECIPIENT
                        </span>
                        <code>{review.profile.trustedRecipient}</code>
                        <p>The supplier reference already in the workspace.</p>
                      </div>
                      <div>
                        <span>
                          <ArrowRight size={15} /> PROPOSED RECIPIENT
                        </span>
                        <code>{review.invoice.recipient}</code>
                        <p>The new instruction changes where funds would go.</p>
                      </div>
                    </div>
                    <div className="journey-callout amber">
                      <ShieldCheck size={21} />
                      <div>
                        <strong>Changed destination. Independent check required.</strong>
                        <p>The invoice can look legitimate while redirecting a payment.</p>
                      </div>
                    </div>
                  </>
                )}
                {step === 2 && (
                  <>
                    <div className="journey-paths">
                      <article>
                        <span>THE VULNERABLE PROCEDURE</span>
                        <h3>Trust the familiar document.</h3>
                        <p>
                          Illustrative failure: accepting the known supplier name and amount without
                          comparing recipients could send funds to the changed address.
                        </p>
                        <small>This is a hypothetical failure, not an enabled app mode.</small>
                      </article>
                      <article>
                        <span>PAYGUARD’S PROTECTED PATH</span>
                        <h3>
                          {review.gate.allowed
                            ? 'Human confirmation is current.'
                            : 'Pause the approval.'}
                        </h3>
                        <p>{review.gate.reason}</p>
                      </article>
                    </div>
                    <button
                      className="button outline"
                      onClick={() => {
                        setAttempted(true);
                        log(
                          review.gate.allowed
                            ? 'Practice review eligible after exact independent confirmation.'
                            : 'Approval attempt blocked: independent confirmation missing.',
                        );
                      }}
                    >
                      Try approving this invoice
                    </button>
                    {attempted && (
                      <div role="status" className="journey-callout amber">
                        <LockKeyhole size={19} />
                        <div>
                          <strong>
                            {review.gate.allowed
                              ? 'Current human confirmation permits review.'
                              : 'Approval blocked.'}
                          </strong>
                          <p>
                            {review.gate.allowed
                              ? 'Payment is still unverified.'
                              : 'The same approvalGate function enforces this hold in the owner API.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {step === 3 && (
                  <>
                    <div className="journey-contact">
                      <Phone size={24} />
                      <div>
                        <span>THE INDEPENDENT CHANNEL</span>
                        <h3>Use the pre-established supplier contact.</h3>
                        <p>
                          In production, the reviewer makes this check outside PayGuard. Never
                          validate a request using contact details supplied by that same request.
                        </p>
                      </div>
                    </div>
                    <label className="journey-confirm">
                      <input
                        type="checkbox"
                        checked={!!attestedAt}
                        onChange={(e) => {
                          setAttestedAt(e.target.checked ? new Date().toISOString() : undefined);
                          setExpired(false);
                          invalidate();
                          log(
                            e.target.checked
                              ? 'Practice confirmation recorded for exact original terms via the known channel.'
                              : 'Practice confirmation removed.',
                          );
                        }}
                      />
                      <span>
                        <strong>Record a practice confirmation</strong>
                        <small>
                          Synthetic only: the known supplier contact confirmed these exact
                          instructions. No call was placed.
                        </small>
                      </span>
                    </label>
                    <div className="journey-test-controls">
                      <button
                        className="button outline small"
                        onClick={() => {
                          setEdited((e) => !e);
                          invalidate();
                          log(
                            'Instructions edited; the previous confirmation no longer covers them.',
                          );
                        }}
                      >
                        {edited
                          ? 'Restore original instructions'
                          : 'Edit instructions after verification'}
                      </button>
                      <button
                        className="button outline small"
                        disabled={!attestedAt}
                        onClick={() => {
                          setExpired((e) => !e);
                          invalidate();
                          log('Checked the 30-day confirmation expiry.');
                        }}
                      >
                        {expired ? 'Use current confirmation' : 'Test a 31-day-old confirmation'}
                      </button>
                    </div>
                    <p role="status" className="journey-gate-result">
                      <ShieldCheck size={17} />
                      {review.gate.reason}
                    </p>
                    {edited && (
                      <blockquote className="instruction-quote">
                        {review.instruction.message}
                        <small> Untrusted invoice text cannot approve a payment.</small>
                      </blockquote>
                    )}
                    <p className="journey-plain-note">
                      Confirmation covers one exact instruction snapshot and supplier-reference
                      revision. Edits invalidate it; positive confirmation expires after 30 days.
                    </p>
                  </>
                )}
                {step === 4 && (
                  <>
                    <div className="journey-timeline">
                      <span>
                        <Check size={14} /> Human correction
                      </span>
                      <i />
                      <span>
                        <Check size={14} /> Confirmed Walrus write
                      </span>
                      <i />
                      <span>
                        <Check size={14} /> New-session recall
                      </span>
                    </div>
                    <div className="journey-memory-control">
                      <div>
                        <strong>Later invoice, same pattern.</strong>
                        <p>What does the review remember?</p>
                      </div>
                      <div className="segmented">
                        <button
                          aria-pressed={!on}
                          className={!on ? 'active' : ''}
                          onClick={() => {
                            setOn(false);
                            log('Memory OFF retained the baseline checks.');
                          }}
                        >
                          Memory OFF
                        </button>
                        <button
                          aria-pressed={on}
                          className={on ? 'active mint-active' : ''}
                          onClick={() => {
                            setOn(true);
                            log(
                              'Actual recorded Walrus citations added the learned escalation context.',
                            );
                          }}
                        >
                          Memory ON
                        </button>
                      </div>
                    </div>
                    <div className="journey-comparison">
                      <article>
                        <span>BASELINE · ALWAYS ACTIVE</span>
                        <h3>Recipient changed.</h3>
                        <p>Verify the new destination through the known supplier channel.</p>
                        <Badge tone="amber">{off.assessment.level}</Badge>
                      </article>
                      <article className={on ? 'remembered' : ''}>
                        <span>
                          {on ? 'APPLICABLE RECALLED CONTEXT' : 'TURN MEMORY ON TO COMPARE'}
                        </span>
                        <h3>
                          {on ? 'Escalate this repeated pattern.' : 'The learned rule is excluded.'}
                        </h3>
                        <p>
                          {on
                            ? `${learned.assessment.citations.length} applicable confirmed citations add the owner-approved procedure. The independent-verification hold remains.`
                            : 'Memory OFF removes learned soft rules. It does not remove hard safety checks.'}
                        </p>
                        <Badge tone={on ? 'cyan' : 'neutral'}>
                          {on ? learned.assessment.level : 'Baseline only'}
                        </Badge>
                      </article>
                    </div>
                    {on && (
                      <details className="journey-provenance">
                        <summary>
                          <BrainCircuit size={17} /> Inspect the actual recalled policies & receipts
                        </summary>
                        <FindingList assessment={review.assessment} />
                        {review.assessment.citations.map((c) => (
                          <div key={c.id}>
                            <strong>Actual recalled Mainnet blob</strong>
                            <code>{c.blobId}</code>
                            <p>{recorded.policies.find((p) => p.id === c.policyId)?.text}</p>
                          </div>
                        ))}
                      </details>
                    )}
                    <p className="journey-plain-note">
                      Recorded real semantic recall, captured {recorded.capturedAt.slice(0, 10)}.
                      Public controls replay this evidence through the application’s rules; owner
                      reviews query Walrus live.{' '}
                      <Link href="/proof#memory">
                        {memories.confirmedMemories.length} confirmed records & provenance ↗
                      </Link>
                    </p>
                  </>
                )}
                {step === 5 && (
                  <>
                    <div className="journey-chain-result">
                      <div>
                        <span>REAL TRANSACTION EXECUTION</span>
                        <strong>
                          <Check size={19} /> Successful
                        </strong>
                        <p>A public Sui Mainnet transaction actually executed.</p>
                      </div>
                      <div>
                        <span>MATCH TO THIS SYNTHETIC INVOICE</span>
                        <strong className="amber-text">{chain.status}</strong>
                        <p>The proposed supplier recipient received zero SUI.</p>
                      </div>
                    </div>
                    <div className="journey-transfer">
                      <div>
                        <span>Expected under sample agreement</span>
                        <strong>500 SUI</strong>
                      </div>
                      <ArrowRight size={21} />
                      <div>
                        <span>Actual credit to sample recipient</span>
                        <strong>0 SUI</strong>
                      </div>
                    </div>
                    <p className="journey-plain-note">
                      The 500 SUI agreement is fictional and separate from the $1,250 invoice
                      amount; no exchange rate is assumed. The real transaction is unrelated to this
                      supplier.
                    </p>
                    <details className="journey-provenance">
                      <summary>Open the recorded Tatum receipt</summary>
                      <dl className="detail-list">
                        <div>
                          <dt>Digest</dt>
                          <dd>
                            <code>{chain.digest}</code>
                          </dd>
                        </div>
                        <div>
                          <dt>Finalized checkpoint</dt>
                          <dd>{chain.transaction.checkpoint}</dd>
                        </div>
                        <div>
                          <dt>Expected integer units</dt>
                          <dd>{chain.expectedAtomic}</dd>
                        </div>
                        <div>
                          <dt>Actual integer units</dt>
                          <dd>{chain.receivedAtomic}</dd>
                        </div>
                      </dl>
                      <p>
                        Integer units avoid rounding; SUI has nine decimal places. This is dated
                        gRPC evidence, not a live request from this page.
                      </p>
                      <a
                        className="inline-link"
                        href={chain.explorer}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Inspect on SuiScan ↗
                      </a>
                    </details>
                    <div className="journey-callout">
                      <ShieldCheck size={20} />
                      <p>
                        A successful transfer proves movement of value. It does not prove supplier
                        identity or authorization.
                      </p>
                    </div>
                  </>
                )}
                {step === 6 && (
                  <>
                    <div className="journey-outcome">
                      <Badge tone={review.gate.allowed ? 'mint' : 'amber'}>
                        {review.gate.allowed
                          ? 'Current practice confirmation'
                          : 'Independent verification still required'}
                      </Badge>
                      <p>{review.gate.reason}</p>
                      <div className="review-actions">
                        <button
                          className="button primary"
                          onClick={() => {
                            const result = review.gate.allowed
                              ? 'Human review approved for these exact confirmed instructions. Payment remains unverified.'
                              : 'Approval blocked. Request independent supplier verification.';
                            setDecision(result);
                            setComplete(false);
                            log(result);
                          }}
                        >
                          Record review decision
                        </button>
                        <button
                          className="button outline"
                          onClick={() => {
                            setDecision('Escalated to a human reviewer.');
                            setComplete(false);
                            log('Escalated to a human reviewer.');
                          }}
                        >
                          Escalate instead
                        </button>
                      </div>
                      {decision && (
                        <p role="status" className="journey-decision">
                          {decision}
                        </p>
                      )}
                    </div>
                    <h3 className="journey-audit-title">Your practice audit</h3>
                    <ol className="journey-audit">
                      {events.map((e, i) => (
                        <li key={i}>
                          <span>{String(i + 1).padStart(2, '0')}</span>
                          <p>{e}</p>
                        </li>
                      ))}
                    </ol>
                    {complete && (
                      <div className="journey-callout">
                        <Check size={23} />
                        <div>
                          <strong>Walkthrough complete.</strong>
                          <p>
                            You inspected the switch, exercised the hold and recorded a practice
                            outcome. No invoice was paid and no owner record was changed.
                          </p>
                          <Link className="inline-link" href="/app">
                            Explore the sample dashboard <ArrowRight size={14} />
                          </Link>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <aside className="journey-explanation">
                  <span>WHY THIS MATTERS</span>
                  <p>{current.explain}</p>
                </aside>
              </motion.section>
              <nav className="journey-navigation" aria-label="Step navigation">
                <button
                  className="button outline"
                  onClick={() => go(step - 1)}
                  disabled={step === 0}
                >
                  <ArrowLeft size={16} /> Back
                </button>
                <div>
                  <span>{step === 6 ? 'Record an outcome to finish' : 'UP NEXT'}</span>
                  <strong>
                    {step === 6 ? 'Your review, with a reason.' : steps[step + 1].title}
                  </strong>
                </div>
                <button
                  className="button primary"
                  disabled={step === 6 && !decision}
                  onClick={() => {
                    if (step < 6) go(step + 1);
                    else if (complete) reset();
                    else {
                      setComplete(true);
                      log('Completed the local practice walkthrough.');
                    }
                  }}
                >
                  {step === 6 ? (complete ? 'Start again' : 'Finish walkthrough') : 'Next Step'}
                  <ArrowRight size={16} />
                </button>
              </nav>
            </div>
          </div>
          <footer className="journey-footer">
            <span>
              <LockKeyhole size={14} /> Public demo: synthetic data, no private writes.
            </span>
            <p>
              Owner mode is for authenticated invoice reviews and live integrations.{' '}
              <Link href="/app?signin=1">Owner Sign In ↗</Link>
            </p>
          </footer>
        </main>
      </fieldset>
    </MotionConfig>
  );
}
