'use client';
import Link from 'next/link';
import { motion, MotionConfig } from 'motion/react';
import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ShieldCheck,
  Phone,
  BrainCircuit,
  LockKeyhole,
  FileText,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import { judgeReview } from '@/lib/judge';
import type { Policy } from '@/lib/types';
import recall from '../../docs/evidence/judge-recall.json';
import proof from '../../docs/evidence/walrus-confirmed.json';
const source = 'https://github.com/sopskistar/payguard-ai/blob/main/docs/';
const faqs = [
  [
    'Is the interactive demo using real customer invoices?',
    'No. The invoice, supplier and callback are clearly labeled practice data. The Walrus memory receipts and Tatum transaction evidence come from genuine completed tests. Public interactions replay those dated results without accessing private customer records.',
  ],
  [
    'Does PayGuard approve or send supplier payments?',
    'PayGuard enforces review holds inside this application. An authorized human can record independent verification and a review decision. No supplier payment is sent. A successful onchain transfer does not prove who owns the recipient or that a supplier authorized it.',
  ],
  [
    'What does “remembered” mean?',
    'The owner saves a minimized approved policy to Walrus Mainnet. A later review must retrieve an applicable, confirmed memory before its soft learned rule is used. The public demo replays a real recorded recall; the owner workspace makes live provider requests.',
  ],
  [
    'Can anyone create an account or connect a wallet?',
    'Connect Sui Wallet creates an individual account after a server-verified personal-message signature. Each account has separate records. Owner Sign In is reserved for the administrator. The public demo requires neither. Wallet Watch is read-only. The separate, disabled-by-default Testnet service-payment pilot supports wallet signing and has no proven settlement yet.',
  ],
  [
    'What are the limits?',
    'PayGuard records human attestations; it does not place calls, authenticate email headers, prove supplier identity or guarantee fraud prevention. Memory can expire or be unavailable. Hard verification checks remain active even with Memory OFF.',
  ],
];
export function Landing() {
  const [memory, setMemory] = useState(false);
  const review = judgeReview(memory, recall.policies as Policy[], recall.citations);
  return (
    <MotionConfig reducedMotion="user">
      <div className="site-home">
        <header className="site-nav">
          <Link href="/" aria-label="PayGuard home">
            <img src="/brand/logo.png" alt="PayGuard AI" className="site-logo" />
          </Link>
          <nav aria-label="Page sections">
            <a href="#how-it-works">How it works</a>
            <a href="#evidence">Real evidence</a>
            <a href="#questions">Questions</a>
          </nav>
          <Link href="/app?signin=1" className="site-owner">
            <LockKeyhole size={14} /> Owner Sign In <ArrowUpRight size={14} />
          </Link>
        </header>
        <main id="main">
          <section className="site-hero">
            <motion.div
              className="site-hero-copy"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              <span className="site-eyebrow">
                <span /> PAYGUARD VERIFY · PAYMENT INSTRUCTION REVIEW
              </span>
              <h1>
                Same supplier.
                <br />
                Different recipient.
                <br />
                <em>Stop the switch.</em>
              </h1>
              <p>
                A convincing invoice can send you to the wrong wallet. Compare the payment details,
                verify changes through a known contact, and remember the rule for next time.
              </p>
              <Link href="/try" className="button primary site-cta">
                Try Interactive Demo <ArrowRight size={18} />
              </Link>
              <Link href="/connect" className="button outline site-cta">
                Connect Sui Wallet <ArrowUpRight size={16} />
              </Link>
              <div className="site-hero-note">
                <Check size={14} /> Three minutes <span>·</span> No account, wallet or funds needed
              </div>
              <p className="site-owner-note">
                Review your own invoices in a private wallet account. Owner Sign In is administrator
                access.
              </p>
            </motion.div>
            <motion.div
              className="site-case"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="site-case-top">
                <span>
                  <ShieldCheck size={17} /> PAYGUARD / REVIEW 001
                </span>
                <span className="site-sample">SYNTHETIC EXAMPLE</span>
              </div>
              <div className="site-case-invoice">
                <div className="site-monogram">N</div>
                <div>
                  <h2>Northstar Studio</h2>
                  <p>Monthly design retainer · NS-1048</p>
                </div>
                <strong>
                  $1,250<small>.00 USD</small>
                </strong>
              </div>
              <div className="site-address">
                <span>
                  <CheckCircle2 size={15} /> Established recipient
                </span>
                <code>
                  0x1111<span>1111…1111</span>1111
                </code>
                <small>Previously established supplier reference</small>
              </div>
              <div className="site-address proposed">
                <span>
                  <ArrowUpRight size={15} /> Recipient on the new invoice
                </span>
                <code>
                  0x2222<span>2222…2222</span>2222
                </code>
                <small>The amount stayed the same. The recipient did not.</small>
              </div>
              <div className="site-hold">
                <LockKeyhole size={19} />
                <div>
                  <strong>Approval held</strong>
                  <p>Verify this change through the supplier’s established contact.</p>
                </div>
              </div>
              <div className="site-case-bottom">
                <span>Document familiarity ≠ recipient authorization</span>
                <span>HUMAN REVIEW REQUIRED</span>
              </div>
            </motion.div>
          </section>
          <div className="site-factbar">
            <span>Verify before you pay. Remember what nearly went wrong.</span>
            <span>
              <ShieldCheck size={15} /> Human decisions <i /> No supplier transfers
            </span>
          </div>
          <section className="site-problem" id="problem">
            <div>
              <span className="site-eyebrow">THE DETAIL THAT CHANGES EVERYTHING</span>
              <h2>
                “Our payment details
                <br />
                have changed.”
              </h2>
            </div>
            <div>
              <p>
                Supplier impersonation often arrives inside a perfectly ordinary conversation. A
                familiar name, amount or email thread is not enough to trust a new destination.
              </p>
              <p>
                The FBI recommends checking payment-detail changes using an independently
                established channel. PayGuard turns that practice into a review you can explain and
                audit.
              </p>
              <a
                href="https://www.fbi.gov/how-we-can-help-you/common-frauds-and-scams/business-email-compromise"
                target="_blank"
                rel="noreferrer"
                className="site-link"
              >
                Read the FBI’s BEC guidance <ArrowUpRight size={15} />
              </a>
            </div>
          </section>
          <section className="site-process" id="how-it-works">
            <div className="site-section-title">
              <span className="site-eyebrow">A CLEARER PATH TO A HUMAN DECISION</span>
              <h2>
                Check the change.
                <br />
                Keep the context.
              </h2>
              <p>From the first warning to the next review, every step has a reason.</p>
            </div>
            <div className="site-process-rows">
              {[
                {
                  n: '01',
                  icon: FileText,
                  title: 'Compare the instruction',
                  body: 'Review the invoice beside the established supplier recipient. A new destination triggers a hold—even when everything else looks familiar.',
                  label: 'The difference is visible.',
                },
                {
                  n: '02',
                  icon: Phone,
                  title: 'Verify through a known channel',
                  body: 'Contact the supplier using the number or portal established before the request. Record what the human confirmed, for these exact terms.',
                  label: 'An edited instruction needs a new check.',
                },
                {
                  n: '03',
                  icon: BrainCircuit,
                  title: 'Remember the approved rule',
                  body: 'Save an abstract policy to Walrus. When a later invoice arrives, genuine recall adds the procedure you learned—with a traceable citation.',
                  label: 'No recalled memory, no invented learning.',
                },
              ].map((s) => (
                <motion.article
                  key={s.n}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.35 }}
                >
                  <span className="site-step-no">{s.n}</span>
                  <s.icon size={24} />
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                  </div>
                  <span className="site-step-label">{s.label}</span>
                </motion.article>
              ))}
            </div>
          </section>
          <section className="site-learning" id="memory">
            <div className="site-section-title">
              <span className="site-eyebrow">THE NEXT INVOICE GETS A BETTER REVIEW</span>
              <h2>
                A correction that
                <br />
                outlasts the session.
              </h2>
              <p>
                The baseline catches the changed recipient. A remembered policy adds the
                supplier-specific escalation you approved.
              </p>
            </div>
            <div className="site-learning-demo">
              <div className="site-learning-toolbar">
                <span>
                  <BrainCircuit size={18} /> Northstar · later invoice
                </span>
                <div className="segmented" aria-label="Recorded memory comparison">
                  <button
                    onClick={() => setMemory(false)}
                    aria-pressed={!memory}
                    className={!memory ? 'active' : ''}
                  >
                    Memory OFF
                  </button>
                  <button
                    onClick={() => setMemory(true)}
                    aria-pressed={memory}
                    className={memory ? 'active mint-active' : ''}
                  >
                    Memory ON
                  </button>
                </div>
              </div>
              <div className="site-learning-body" aria-live="polite">
                <span className="site-sample">SYNTHETIC INVOICE · RECORDED REAL RECALL</span>
                <h3>
                  {memory
                    ? 'Remember the escalation. Keep the hold.'
                    : 'Recipient changed. Verification is required.'}
                </h3>
                <p>
                  {memory
                    ? 'The retrieved owner policy adds a specific instruction: escalate a repeated recipient-change pattern and use the established supplier channel.'
                    : 'PayGuard detects the changed destination and requires an independent check. Turning memory off never turns this safeguard off.'}
                </p>
                <div className="site-learning-result">
                  <ShieldCheck size={20} />
                  <span>
                    {review.gate.allowed ? 'Human review eligible' : 'Approval held in both modes'}
                  </span>
                  <strong>
                    {memory
                      ? `${review.assessment.citations.length} applicable citations`
                      : 'Baseline checks active'}
                  </strong>
                </div>
                {memory && (
                  <div className="site-citation">
                    <span>One actual recalled blob</span>
                    <code>{review.assessment.citations[0]?.blobId}</code>
                  </div>
                )}
              </div>
              <div className="site-memory-line">
                <span>
                  <CheckCircle2 size={15} /> Human correction
                </span>
                <i />
                <span>
                  <CheckCircle2 size={15} /> Confirmed Mainnet write
                </span>
                <i />
                <span>
                  <CheckCircle2 size={15} /> New-session recall
                </span>
              </div>
              <p className="site-recorded-note">
                Replayed from the genuine SDK capture of {recall.capturedAt.slice(0, 10)}. The
                public preview makes no live provider calls.{' '}
                <Link href="/proof">Inspect the provenance ↗</Link>
              </p>
            </div>
          </section>
          <section className="site-integrations">
            <div className="site-section-title">
              <span className="site-eyebrow">TWO INTEGRATIONS. TWO DIFFERENT QUESTIONS.</span>
              <h2>
                What did we learn?
                <br />
                What actually moved?
              </h2>
            </div>
            <div className="site-integration-panels">
              <article>
                <div className="site-integration-name">
                  <BrainCircuit size={24} />
                  <h3>Walrus Memory</h3>
                  <span>CONTEXT</span>
                </div>
                <p>
                  Stores minimized, approved policy memories on Mainnet. Semantic recall brings the
                  relevant rule back to a later review, with confirmed job and blob provenance.
                </p>
                <div className="site-integration-fact">
                  <strong>{proof.confirmedMemories.length}</strong>
                  <span>
                    confirmed Mainnet records
                    <br />
                    from synthetic learning events
                  </span>
                </div>
                <Link href="/proof#memory" className="site-link">
                  See the memory receipts <ArrowRight size={15} />
                </Link>
              </article>
              <article>
                <div className="site-integration-name">
                  <ShieldCheck size={24} />
                  <h3>Tatum · Sui</h3>
                  <span>EVIDENCE</span>
                </div>
                <p>
                  Reads real Sui Mainnet transactions over server-side gRPC. Checks execution,
                  recipient, token and exact amount. A successful transaction is not supplier
                  identity.
                </p>
                <div className="site-integration-fact">
                  <strong className="site-mismatch">Mismatch</strong>
                  <span>
                    the real test transaction did not
                    <br />
                    pay the sample supplier
                  </span>
                </div>
                <Link href="/proof#chain" className="site-link">
                  Inspect the transaction check <ArrowRight size={15} />
                </Link>
              </article>
            </div>
          </section>
          <section className="site-evidence" id="evidence">
            <div>
              <span className="site-eyebrow">PROOF YOU CAN OPEN</span>
              <h2>
                Receipts, not a<br />
                “trust us” badge.
              </h2>
              <p>
                Explore the captured results, the exact learning experiment, and the code behind the
                review.
              </p>
              <Link className="site-link" href="/proof">
                Open read-only Mainnet proof <ArrowRight size={16} />
              </Link>
            </div>
            <div className="site-evidence-links">
              <a href={source + 'MAINNET_PROOF.md'} target="_blank" rel="noreferrer">
                <span>01</span>
                <div>
                  <strong>Confirmed Walrus receipts</strong>
                  <small>30 jobs, blobs and completion timestamps</small>
                </div>
                <ArrowUpRight size={19} />
              </a>
              <a href={source + 'MEMORY_EVALUATION.md'} target="_blank" rel="noreferrer">
                <span>02</span>
                <div>
                  <strong>Measured learning behavior</strong>
                  <small>Four supplier scenarios · safeguards retained</small>
                </div>
                <ArrowUpRight size={19} />
              </a>
              <a href="https://sopskistar.github.io/payguard-ai/" target="_blank" rel="noreferrer">
                <span>03</span>
                <div>
                  <strong>The engineering story</strong>
                  <small>Published article · real results and limitations</small>
                </div>
                <ArrowUpRight size={19} />
              </a>
            </div>
          </section>
          <section className="site-faq" id="questions">
            <div className="site-section-title">
              <span className="site-eyebrow">KNOW WHAT YOU’RE USING</span>
              <h2>A few useful answers.</h2>
            </div>
            <div>
              {faqs.map(([q, a]) => (
                <details key={q}>
                  <summary>
                    {q}
                    <ChevronDown size={18} />
                  </summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </section>
          <section className="site-final">
            <img src="/brand/icon.png" alt="" />
            <span className="site-eyebrow">VERIFY BEFORE YOU PAY.</span>
            <h2>
              Find the change before
              <br />
              it becomes a payment.
            </h2>
            <Link href="/try" className="button primary site-cta">
              Try Interactive Demo <ArrowRight size={18} />
            </Link>
            <p>Public practice. Real recorded evidence. You make the final call.</p>
          </section>
        </main>
        <footer className="site-footer">
          <div>
            <img src="/brand/logo.png" className="site-logo" alt="PayGuard AI" />
            <p>
              PayGuard Verify
              <br />
              Supplier instruction review, with memory.
            </p>
          </div>
          <nav aria-label="Footer">
            <Link href="/try">Interactive demo</Link>
            <Link href="/app">Sample dashboard</Link>
            <Link href="/proof">Mainnet proof</Link>
            <a href="https://sopskistar.github.io/payguard-ai/">Technical article</a>
            <a href="https://github.com/sopskistar/payguard-ai">Source code ↗</a>
            <Link href="/app?signin=1">Owner Sign In</Link>
          </nav>
          <div className="site-footer-note">
            <span>Built for Total Recall · Smart Agents for Real Life</span>
            <span>Decision support. Human accountability. No fraud-prevention guarantee.</span>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
