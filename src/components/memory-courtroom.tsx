'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Play,
  Pause,
  RotateCcw,
  ShieldCheck,
  ArrowRight,
  BrainCircuit,
  LockKeyhole,
} from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { Brand } from './brand';
import { PaymentEvidence } from './payment-evidence';
import evidence from '../../docs/evidence/courtroom.json';
import recall from '../../docs/evidence/judge-recall.json';
import { judgeReview } from '@/lib/judge';
import type { Assessment, Finding, Policy } from '@/lib/types';
function ReviewFindings({ items, baseline }: { items: Finding[]; baseline: Set<string> }) {
  return (
    <ul>
      {items.map((f, i) => (
        <li key={f.id + i} className={f.memoryId || !baseline.has(f.id) ? 'learned' : ''}>
          <span className="courtroom-provenance">
            {f.memoryId
              ? 'Confirmed learned policy'
              : baseline.has(f.id)
                ? 'Retained verification rule'
                : 'Additional context'}{' '}
            · {f.severity}
          </span>
          <h3>{f.title}</h3>
          <p>{f.evidence}</p>
          <p>
            <strong>Next action:</strong> {f.action}
          </p>
          {f.memoryId && <code>Memory reference: {f.memoryId}</code>}
        </li>
      ))}
    </ul>
  );
}
const stages = [
  'Inspect invoice',
  'Baseline rules',
  'Recall confirmed context',
  'Compare explanations',
  'Keep the human hold',
];
export function MemoryCourtroom() {
  const [selected, setSelected] = useState(2),
    [attack, setAttack] = useState(false),
    [stage, setStage] = useState(0),
    [playing, setPlaying] = useState(false),
    [view, setView] = useState('both');
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!playing || reduced) return;
    const timer = setInterval(() => {
      if (stage >= stages.length - 1) setPlaying(false);
      else setStage(stage + 1);
    }, 5000);
    return () => clearInterval(timer);
  }, [playing, reduced, stage]);
  const scenario = evidence.scenarios[selected];
  const off: Assessment = attack
    ? judgeReview(false, recall.policies as Policy[], recall.citations, undefined, true).assessment
    : (scenario.off as Assessment);
  const on: Assessment = attack
    ? judgeReview(true, recall.policies as Policy[], recall.citations, undefined, true).assessment
    : (scenario.on as Assessment);
  const memo = attack
    ? judgeReview(false, recall.policies as Policy[], recall.citations, undefined, true).invoice
        .memo
    : scenario.memo;
  const baseline = new Set(off.findings.map((f) => f.id));
  const learning = evidence.timeline;
  function reset(play = false) {
    setStage(0);
    setPlaying(play && !reduced);
  }
  return (
    <div className="courtroom-page">
      <header className="site-nav">
        <Link href="/" aria-label="PayGuard home">
          <Brand />
        </Link>
        <nav aria-label="Courtroom navigation">
          <Link href="/try">Interactive demo</Link>
          <Link href="/proof">Mainnet proof</Link>
          <Link href="/connect">Connect wallet</Link>
        </nav>
      </header>
      <main id="main">
        <section className="courtroom-hero">
          <div>
            <span className="site-eyebrow">MEMORY COURTROOM · FREE PUBLIC EVALUATION</span>
            <h1>
              Same invoice.
              <br />
              <em>More context.</em>
              <br />
              Same human hold.
            </h1>
            <p>
              Watch confirmed supplier context enrich a review without becoming permission to pay.
              Compare both sides in under a minute.
            </p>
            <div className="courtroom-playback">
              <a className="button primary" href="#memory-comparison">
                Compare OFF / ON <ArrowRight size={16} />
              </a>
              <a className="button outline" href="#mainnet-purchases">
                Inspect three receipts
              </a>
            </div>
            <div className="courtroom-facts">
              <span>
                <strong>{evidence.confirmedMemories}</strong> confirmed records
              </span>
              <span>
                <strong>{evidence.ownerMemories}</strong> owner + 2 controlled scopes
              </span>
              <span>
                <strong>{evidence.scenarios.length}</strong> paid experiments
              </span>
            </div>
          </div>
          <aside className="courtroom-case-file">
            <span className="site-eyebrow">EVIDENCE, WITH ITS BOUNDARIES</span>
            <p>
              <BrainCircuit size={19} /> Actual Walrus Mainnet recall, captured{' '}
              {evidence.capturedAt.slice(0, 10)}.
            </p>
            <p>
              <ShieldCheck size={19} /> Synthetic supplier scenarios. Genuine storage and
              transaction receipts.
            </p>
            <p>
              <LockKeyhole size={19} /> Public replay. No private data, wallet request, provider
              charge or live anonymous recall.
            </p>
            <Link className="inline-link" href="/connect">
              Use your own isolated workspace <ArrowRight size={16} />
            </Link>
          </aside>
        </section>
        <section className="courtroom-console" aria-label="Memory comparison controls">
          <label>
            Choose an existing synthetic case
            <select
              aria-label="Courtroom scenario"
              value={selected}
              onChange={(e) => {
                setSelected(Number(e.target.value));
                setAttack(false);
                reset();
              }}
            >
              {evidence.scenarios.map((s, i) => (
                <option key={s.number} value={i}>
                  {s.number} · {s.supplier}
                </option>
              ))}
            </select>
          </label>
          <button
            className={'button ' + (attack ? 'primary' : 'outline')}
            aria-pressed={attack}
            onClick={() => {
              setAttack(!attack);
              reset();
            }}
          >
            Replay invoice attack
          </button>
          <div className="courtroom-playback">
            <button
              className="button primary"
              disabled={!!reduced || playing}
              onClick={() => setPlaying(true)}
            >
              <Play size={15} /> Play
            </button>
            <button
              className="button outline"
              disabled={!playing}
              onClick={() => setPlaying(false)}
            >
              <Pause size={15} /> Pause
            </button>
            <button className="button outline" onClick={() => reset()}>
              <RotateCcw size={15} /> Reset
            </button>
            <button className="button outline" onClick={() => reset(true)}>
              Replay
            </button>
          </div>
          {reduced && (
            <p>
              Reduced motion is active. Use the step controls below; all evidence stays available.
            </p>
          )}
          <ol className="courtroom-steps" aria-label="Review replay steps">
            {stages.map((s, i) => (
              <li key={s}>
                <button
                  aria-current={stage === i ? 'step' : undefined}
                  onClick={() => {
                    setPlaying(false);
                    setStage(i);
                  }}
                >
                  <span>0{i + 1}</span>
                  {s}
                </button>
              </li>
            ))}
          </ol>
          <p role="status">
            Step {stage + 1} of {stages.length}: {stages[stage]}.{' '}
            {playing
              ? 'Replay advances every five seconds.'
              : 'Paused; inspect evidence at your own pace.'}
          </p>
        </section>
        <section className="courtroom-invoice">
          <div>
            <span className="site-eyebrow">
              {attack ? 'SYNTHETIC ATTACK · BUNDLED NORTHSTAR CASE' : scenario.number}
            </span>
            <h2>
              {attack
                ? 'An invoice cannot rewrite the rules.'
                : 'Changed payout instructions, familiar supplier.'}
            </h2>
          </div>
          <blockquote>{memo}</blockquote>
          <p>
            Invoice text is untrusted data. The existing <code>instructionSignals</code>,{' '}
            <code>evaluate</code> and <code>approvalGate</code> functions enforce this boundary.{' '}
            {attack
              ? 'This attack variant runs those actual pure review functions in your browser using the existing Northstar sample and dated recall.'
              : `Both reviews below were captured from the same saved invoice and application engine at ${scenario.capturedAt}.`}
          </p>
        </section>
        <div className="courtroom-view" id="memory-comparison" aria-label="Comparison view">
          {[
            ['both', 'Side by side'],
            ['off', 'Memory OFF'],
            ['on', 'Memory ON'],
          ].map(([id, name]) => (
            <button
              className="button outline"
              key={id}
              aria-pressed={view === id}
              onClick={() => setView(id)}
            >
              {name}
            </button>
          ))}
        </div>
        <section
          className={'courtroom-comparison ' + (view !== 'both' ? 'single' : '')}
          aria-label="Memory OFF and ON comparison"
          data-stage={stage}
        >
          {(['off', 'on'] as const)
            .filter((side) => view === 'both' || view === side)
            .map((side) => {
              const result = side === 'off' ? off : on;
              const preview =
                side === 'on'
                  ? [
                      ...result.findings.filter((f) => f.memoryId).slice(0, 1),
                      ...result.findings.filter((f) => !f.memoryId).slice(0, 2),
                    ]
                  : result.findings.slice(0, 3);
              const additional = result.findings.filter((f) => !preview.includes(f));
              return (
                <article
                  key={side}
                  className={'courtroom-review ' + side}
                  aria-label={'Memory ' + side.toUpperCase() + ' review'}
                >
                  <header>
                    <span className="site-eyebrow">
                      {side === 'off' ? 'BASELINE' : 'BASELINE + CONFIRMED CONTEXT'}
                    </span>
                    <h2>Memory {side.toUpperCase()}</h2>
                    <p>
                      {side === 'off'
                        ? 'No learned citations applied. Mandatory verification rules remain.'
                        : `${result.citations.length} retrieved citations; ${result.findings.filter((f) => f.memoryId).length} findings reference learned context.`}
                    </p>
                  </header>
                  <p className="courtroom-hold">
                    <ShieldCheck size={17} /> Human verification required · approval held
                  </p>
                  <p className="muted">
                    {side === 'on'
                      ? 'One remembered policy leads the comparison; baseline checks still apply.'
                      : 'Three baseline findings lead the comparison.'}{' '}
                    All {result.findings.length} findings remain inspectable.
                  </p>
                  <ReviewFindings items={preview} baseline={baseline} />
                  {additional.length > 0 && (
                    <details>
                      <summary>Inspect {additional.length} additional findings</summary>
                      <ReviewFindings items={additional} baseline={baseline} />
                    </details>
                  )}
                  <details>
                    <summary>
                      Inspect rule provenance and citations ({result.citations.length})
                    </summary>
                    <p>{result.memoryStatus}</p>
                    {result.citations.map((c) => {
                      const job = evidence.citations.find((j) => j.id === c.id);
                      return (
                        <div className="courtroom-citation" key={c.id}>
                          <p>{c.text}</p>
                          <dl>
                            <dt>Confirmed blob</dt>
                            <dd>
                              <code>{c.blobId}</code>
                            </dd>
                            <dt>Policy / memory</dt>
                            <dd>
                              <code>
                                {c.policyId} / {c.id}
                              </code>
                            </dd>
                            {job && (
                              <>
                                <dt>Job / namespace</dt>
                                <dd>
                                  <code>
                                    {job.job_id}
                                    <br />
                                    {job.namespace}
                                  </code>
                                </dd>
                                <dt>Confirmed at</dt>
                                <dd>{job.completed_at}</dd>
                              </>
                            )}
                          </dl>
                        </div>
                      );
                    })}
                  </details>
                </article>
              );
            })}
        </section>
        <section className="courtroom-verdict">
          <ShieldCheck size={27} />
          <div>
            <h2>Memory enriches the explanation. A human verifies the change.</h2>
            <p>
              Neither review grants approval or creates a trusted memory. An authenticated reviewer
              must independently verify the instructions and explicitly consent to a minimized
              correction in their own workspace. Invoice text cannot call that workflow.
            </p>
            <Link className="inline-link" href="/app/review">
              Inspect the private review workflow ↗
            </Link>
          </div>
        </section>
        <section className="courtroom-learning">
          <span className="site-eyebrow">GENUINE LEARNING TIMELINE</span>
          <h2>A recorded correction, recalled in a later session.</h2>
          <p>
            This timeline concerns the earlier synthetic invoice {learning.source_invoice}, followed
            by the captured Experiment 3 review. It is not a fabricated sequence of events on the
            selected invoice.
          </p>
          <ol>
            {[
              ['Earlier invoice reviewed', learning.reviewed_at],
              ['Explicit human correction recorded', learning.correction_at],
              ['Walrus write confirmed', learning.completed_at],
              ['Fresh-session recall', evidence.freshRecall.capturedAt],
              ['Memory-informed review captured', evidence.freshRecall.capturedAt],
            ].map(([name, time]) => (
              <li key={name!}>
                <strong>{name}</strong>
                <time>{time}</time>
              </li>
            ))}
          </ol>
          <details>
            <summary>Inspect the exact job, blob, namespace and recall link</summary>
            <dl className="detail-list">
              <div>
                <dt>Walrus job</dt>
                <dd>
                  <code>{learning.job_id}</code>
                </dd>
              </div>
              <div>
                <dt>Confirmed blob</dt>
                <dd>
                  <code>{learning.blob_id}</code>
                </dd>
              </div>
              <div>
                <dt>Namespace</dt>
                <dd>
                  <code>{learning.namespace}</code>
                </dd>
              </div>
              <div>
                <dt>Fresh-session match</dt>
                <dd>
                  {evidence.freshRecall.exactBlobRecalledAgain
                    ? 'A previously recalled exact blob appeared again after logout and a new authenticated context.'
                    : 'Inspect captured evidence.'}
                </dd>
              </div>
            </dl>
            <a
              className="inline-link"
              href="https://github.com/sopskistar/payguard-ai/blob/main/docs/evidence/courtroom.json"
            >
              Full captured comparison and timeline ↗
            </a>
          </details>
        </section>
        <PaymentEvidence />
        <footer className="courtroom-footer">
          <Link className="button primary" href="/try">
            Seven-step judge walkthrough <ArrowRight size={16} />
          </Link>
          <Link className="button outline" href="/connect">
            Create your wallet workspace
          </Link>
          <Link href="/services">Optional real 0.001 SUI analysis</Link>
        </footer>
      </main>
    </div>
  );
}
