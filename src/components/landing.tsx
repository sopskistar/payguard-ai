'use client';
import Link from 'next/link';
import { motion, MotionConfig } from 'motion/react';
import {
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  BrainCircuit,
  ScanLine,
  Fingerprint,
  ChevronRight,
  LockKeyhole,
  Check,
  Layers3,
} from 'lucide-react';
import { useState } from 'react';
export function Landing() {
  const [memory, setMemory] = useState(false);
  return (
    <MotionConfig reducedMotion="user">
      <div className="landing">
        <nav className="landing-nav">
          <Link href="/" aria-label="PayGuard home">
            <img className="wordmark" src="/brand/logo.png" alt="PayGuard AI" />
          </Link>
          <div className="landing-links">
            <a href="#how-it-works">How it works</a>
            <a href="#features">Features</a>
            <a href="#architecture">Architecture</a>
          </div>
          <Link className="button outline small" href="/app">
            Open Verify <ArrowUpRight size={16} />
          </Link>
        </nav>
        <main id="main">
          <section className="hero">
            <div className="hero-grid" />
            <motion.div
              className="hero-copy"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65 }}
            >
              <span className="eyebrow">
                <span className="status-dot" /> PAYGUARD VERIFY · SUPPLIER INSTRUCTION REVIEW
              </span>
              <h1>
                The invoice is familiar.
                <br />
                The recipient changed.
                <br />
                <span>Verify before you pay.</span>
              </h1>
              <p>
                Compare supplier payment instructions with established vendor records, verify
                changes through a known contact, and remember the policy for next time.
              </p>
              <div className="hero-actions">
                <Link href="/try" className="button primary">
                  Try the judge sandbox <ArrowUpRight size={19} />
                </Link>
                <Link className="button text-button" href="/app/replay">
                  Replay an attack <ArrowRight size={18} />
                </Link>
              </div>
              <div className="hero-footnote">
                <LockKeyhole size={14} /> Watch-only by design <span>•</span> You stay in control
              </div>
            </motion.div>
            <motion.div
              className="hero-visual"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, delay: 0.15 }}
            >
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="orbit orbit-three" />
              <div className="radar-sweep" />
              <div className="shield-core">
                <img src="/brand/icon.png" alt="PayGuard shield guarding an invoice review" />
              </div>
              <div className="floating-note note-one">
                <div className="note-icon mint">
                  <ScanLine size={19} />
                </div>
                <div>
                  <small>INVOICE REVIEW</small>
                  <strong>A new recipient detected</strong>
                  <span>Independent verification required</span>
                </div>
              </div>
              <div className="floating-note note-two">
                <div className="note-icon cyan">
                  <BrainCircuit size={19} />
                </div>
                <div>
                  <small>DESIGNED TO REMEMBER</small>
                  <strong>Your corrections. Future context.</strong>
                  <span>Powered by Walrus Memory</span>
                </div>
              </div>
              <span className="visual-caption">ILLUSTRATION · NO LIVE TRANSACTION</span>
            </motion.div>
          </section>
          <div className="tech-strip">
            <span>BUILT FOR REAL-WORLD CONTEXT</span>
            <strong>
              <Layers3 size={19} /> Walrus Memory
            </strong>
            <strong>
              <Fingerprint size={19} /> Tatum
            </strong>
            <strong>
              <span className="sui-mark">◈</span> Sui Mainnet
            </strong>
            <strong>
              Neon <span className="muted">Postgres</span>
            </strong>
          </div>
          <section className="landing-section" id="learn">
            <div className="section-heading">
              <div>
                <span className="eyebrow">A GUARDIAN THAT GETS CONTEXT</span>
                <h2>
                  Same invoice.
                  <br />
                  <span className="muted">A more informed review.</span>
                </h2>
              </div>
              <p>
                Most payment tools remember transactions. PayGuard remembers why you questioned one,
                and brings that context to the next review.
              </p>
            </div>
            <div className="learn-grid">
              <div className="sample-invoice">
                <div className="panel-top">
                  <span className="vendor-avatar">N</span>
                  <span className="badge neutral">Sample data</span>
                </div>
                <h3>Northstar Studio</h3>
                <p>Design retainer · NS-1048</p>
                <div className="invoice-value">
                  $1,250<span>.00</span>
                </div>
                <div className="invoice-line">
                  <span>Recipient</span>
                  <code>0x2222…2222</code>
                </div>
                <div className="invoice-line">
                  <span>Change detected</span>
                  <span className="amber-text">New payout address</span>
                </div>
              </div>
              <div className="learn-explanation">
                <div className="segmented" aria-label="Memory preview mode">
                  <button
                    aria-pressed={!memory}
                    className={!memory ? 'active' : ''}
                    onClick={() => setMemory(false)}
                  >
                    Before memory
                  </button>
                  <button
                    aria-pressed={memory}
                    className={memory ? 'active' : ''}
                    onClick={() => setMemory(true)}
                  >
                    After memory
                  </button>
                </div>
                <span className="badge amber">
                  {memory ? 'Live recall requires setup' : 'Generic rule · Sample invoice'}
                </span>
                <h3>
                  {memory
                    ? 'Your correction belongs in the next review.'
                    : 'The recipient address has changed.'}
                </h3>
                <p>
                  {memory
                    ? 'In the app, save a correction to Walrus Mainnet, open a later invoice, and recheck. The learned rule only appears when Walrus actually returns that memory.'
                    : 'PayGuard compares this recipient with confirmed vendor history and asks you to verify it independently.'}
                </p>
                <div className="context-note">
                  <BrainCircuit size={19} />
                  <span>
                    {memory
                      ? 'No memory is claimed in this preview. Explore the Memory Lab to run the verifiable learning loop.'
                      : 'Baseline findings come from the deterministic engine. No paid AI key is needed.'}
                  </span>
                </div>
                <Link className="inline-link" href="/app/memory">
                  Try the learning loop <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </section>
          <section className="landing-section" id="how-it-works">
            <span className="eyebrow">THREE STEPS. ONE CLEARER DECISION.</span>
            <h2>From invoice to insight.</h2>
            <div className="feature-grid">
              {[
                {
                  icon: ScanLine,
                  n: '01',
                  title: 'Bring the invoice.',
                  body: 'Add details or extract text from PDF, TXT and CSV. Review every field before it enters your inbox.',
                },
                {
                  icon: ShieldCheck,
                  n: '02',
                  title: 'Check the evidence.',
                  body: 'See duplicate patterns, changed recipients and amount anomalies. Inspect Sui payment evidence through Tatum.',
                },
                {
                  icon: BrainCircuit,
                  n: '03',
                  title: 'Teach your guardian.',
                  body: 'Save an approved correction to Walrus. Recall its context across sessions, with a visible trail back to the source.',
                },
              ].map((f) => (
                <article className="feature-card" key={f.n}>
                  <div>
                    <f.icon size={25} />
                    <span>{f.n}</span>
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </article>
              ))}
            </div>
          </section>
          <section className="landing-section architecture-section" id="features">
            <div>
              <span className="eyebrow">TRUST THROUGH VISIBILITY</span>
              <h2>
                Less guesswork.
                <br />
                More evidence.
              </h2>
              <p>
                Every recommendation has a reason. Every memory has a status. Every payment match
                needs real chain evidence.
              </p>
              <ul className="check-list">
                <li>
                  <Check /> Human approval stays mandatory
                </li>
                <li>
                  <Check /> No private spending keys or automatic transfers
                </li>
                <li>
                  <Check /> Missing evidence is shown as missing
                </li>
              </ul>
            </div>
            <div className="architecture-card" id="architecture">
              <span className="eyebrow">THE REVIEW LOOP</span>
              {[
                'Invoice + confirmed history',
                'Deterministic review + human correction',
                'Walrus Mainnet memory + semantic recall',
                'Tatum Sui evidence + append-only audit',
              ].map((t, i) => (
                <div className="architecture-step" key={t}>
                  <span>0{i + 1}</span>
                  {t}
                  <ChevronRight size={16} />
                </div>
              ))}
              <p>
                Private records in Neon. Minimized patterns in Walrus. Server-side integration keys.
              </p>
            </div>
          </section>
          <section className="landing-cta">
            <img src="/brand/icon.png" alt="" width="70" />
            <h2>
              A little memory.
              <br />A better next decision.
            </h2>
            <Link className="button primary" href="/app">
              Open PayGuard <ArrowUpRight size={18} />
            </Link>
            <p>Explore the public guided demo. No wallet required.</p>
          </section>
        </main>
        <footer className="landing-footer">
          <img className="wordmark" src="/brand/logo.png" alt="PayGuard AI" />
          <span>The payment guardian that remembers.</span>
          <p>
            Assistive review. Human decisions.
            <br />
            Built for Total Recall · Smart Agents for Real Life
          </p>
        </footer>
      </div>
    </MotionConfig>
  );
}
