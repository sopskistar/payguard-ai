import { LearningReport } from '@/components/learning-report';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, ExternalLink, Check } from 'lucide-react';
import memories from '../../../docs/evidence/walrus-confirmed.json';
import recall from '../../../docs/evidence/judge-recall.json';
import quality from '../../../docs/evidence/memory-quality.json';
import chain from '../../../docs/evidence/tatum-reconciliation.json';
import recheck from '../../../docs/evidence/provider-recheck.json';
import tenants from '../../../docs/evidence/two-tenant-mainnet-memory.json';
import tenantRecheck from '../../../docs/evidence/two-tenant-provider-recheck.json';
export const metadata: Metadata = { title: 'Read-only Mainnet evidence' };
const repo = 'https://github.com/sopskistar/payguard-ai/blob/main/docs/';
export default function ProofPage() {
  return (
    <div className="proof-page">
      <header className="site-nav">
        <Link href="/" aria-label="PayGuard home">
          <img className="site-logo" src="/brand/logo.png" alt="PayGuard Verify" />
        </Link>
        <Link className="site-link" href="/try">
          Try Interactive Demo <ArrowRight size={15} />
        </Link>
      </header>
      <main id="main">
        <div className="proof-heading">
          <span className="site-eyebrow">MAINNET PROOF · READ-ONLY</span>
          <h1>
            Inspect the evidence.
            <br />
            <span>Understand its limits.</span>
          </h1>
          <p>
            These sanitized receipts come from genuine completed tests. The supplier scenarios are
            synthetic. This page reads published artifacts, not private customer data or a live
            provider response.
          </p>
          <div className="proof-mode">
            <ShieldCheck size={18} />
            <span>
              Public demo ≠ owner workspace ≠ recorded Mainnet proof. Each has a separate purpose.
            </span>
          </div>
        </div>
        <section id="memory" className="proof-section">
          <span className="site-eyebrow">01 / WALRUS MEMORY MAINNET</span>
          <h2>{memories.confirmedMemories.length} confirmed memories.</h2>
          <p>
            Every published record has a provider-completed job and blob. All {recheck.confirmed}{' '}
            were independently rechecked through the SDK at {recheck.checkedAt}. Business content is
            minimized synthetic policy learning; no raw invoices or customer contacts are published.
          </p>
          <div className="proof-metrics">
            <div>
              <strong>{memories.confirmedMemories.length}</strong>
              <span>confirmed records</span>
            </div>
            <div>
              <strong>
                {
                  recheck.statuses.filter((s) => s.providerStatus === 'done' && s.matchingBlob)
                    .length
                }
              </strong>
              <span>matching SDK rechecks</span>
            </div>
            <div>
              <strong>0</strong>
              <span>pending records in this published release</span>
            </div>
          </div>
          <details className="proof-details">
            <summary>Inspect all job IDs, blobs and completion times</summary>
            <div className="proof-receipts">
              {memories.confirmedMemories.map((m, i) => (
                <article key={m.id}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>Confirmed Mainnet write · synthetic learning event</strong>
                    <dl>
                      <div>
                        <dt>Job</dt>
                        <dd>
                          <code>{m.jobId}</code>
                        </dd>
                      </div>
                      <div>
                        <dt>Blob</dt>
                        <dd>
                          <code>{m.blobId}</code>
                        </dd>
                      </div>
                      <div>
                        <dt>Completed</dt>
                        <dd>{m.completedAt}</dd>
                      </div>
                    </dl>
                  </div>
                  <Check size={16} />
                </article>
              ))}
            </div>
          </details>
          <div className="proof-links">
            <a href={repo + 'MAINNET_PROOF.md'} target="_blank" rel="noreferrer">
              Full proof ledger <ExternalLink size={13} />
            </a>
            <a href={repo + 'evidence/walrus-confirmed.json'} target="_blank" rel="noreferrer">
              Raw receipts <ExternalLink size={13} />
            </a>
            <a href={repo + 'evidence/provider-recheck.json'} target="_blank" rel="noreferrer">
              SDK recheck <ExternalLink size={13} />
            </a>
          </div>
        </section>
        <section id="isolation" className="proof-section">
          <span className="site-eyebrow">TWO SEPARATE CUSTOMER SCOPES · CONTROLLED LIVE PROOF</span>
          <h2>Two accounts. Two remembered corrections.</h2>
          <p>
            The original 30-record owner collection is preserved. Two additional sponsored Mainnet
            memories were confirmed for independently authenticated, unfunded test identities using
            the local application with real Neon and Walrus. Each later session recalled its own
            correction and applied it to a new synthetic invoice. Both directions rejected foreign
            invoice and memory access. This brings the tracked confirmed total to 32.
          </p>
          <div className="proof-mode">
            <ShieldCheck size={18} />
            <span>
              Controlled API proof does not clear Slush, certify a physical wallet, or establish
              production registration. The shared operator remains trusted; these are
              server-enforced customer boundaries, not separate customer-held encryption keys.
            </span>
          </div>
          <div className="proof-receipts">
            {tenants.tenants.map((t) => (
              <article key={t.memoryId}>
                <span>{t.tenant}</span>
                <div>
                  <strong>
                    New session: 0 citations OFF → {t.rememberedCitations} owned citation ON
                  </strong>
                  <p>Confirmed policy produced a learned finding on the later synthetic review.</p>
                  <dl>
                    <div>
                      <dt>Job</dt>
                      <dd>
                        <code>{t.jobId}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>Blob</dt>
                      <dd>
                        <code>{t.blobId}</code>
                      </dd>
                    </div>
                  </dl>
                </div>
                <Check size={16} />
              </article>
            ))}
          </div>
          <p>
            Both provider jobs independently rechecked through the SDK at {tenantRecheck.checkedAt}.
          </p>
          <div className="proof-links">
            <a
              href={repo + 'evidence/two-tenant-mainnet-memory.json'}
              target="_blank"
              rel="noreferrer"
            >
              Authorization and recall evidence <ExternalLink size={13} />
            </a>
            <a
              href={repo + 'evidence/two-tenant-provider-recheck.json'}
              target="_blank"
              rel="noreferrer"
            >
              Independent provider recheck <ExternalLink size={13} />
            </a>
          </div>
        </section>
        <section className="proof-section">
          <span className="site-eyebrow">02 / ACTUAL RECALL, VISIBLE INFLUENCE</span>
          <h2>A later review recovered the rule.</h2>
          <p>
            The original correction → confirmed write → logout → fresh owner session → exact blob
            recall test passed. A fresh capture at {recall.capturedAt} supplies the public
            walkthrough. The UI replays those confirmed citations through the same deterministic
            rules; it never pretends a public click performed a live recall.
          </p>
          <div className="proof-comparison">
            <div>
              <span>MEMORY OFF</span>
              <strong>{recall.off.level}</strong>
              <p>Changed-recipient warnings retained. No learned soft policies.</p>
            </div>
            <div>
              <span>MEMORY ON</span>
              <strong>{recall.on.level}</strong>
              <p>
                {recall.citations.length} applicable recalled citations added remembered procedure.
              </p>
            </div>
          </div>
          <div className="proof-metrics">
            <div>
              <strong>
                {quality.results.filter((r) => r.applied > 0).length}/{quality.results.length}
              </strong>
              <span>supplier scenarios with applied recall</span>
            </div>
            <div>
              <strong>
                {quality.results.filter((r) => r.baselineFindingsPreserved).length}/
                {quality.results.length}
              </strong>
              <span>baseline safeguards retained</span>
            </div>
            <div>
              <strong>{quality.staleOrWrongScopeApplied}</strong>
              <span>stale or wrong-scope policies applied</span>
            </div>
          </div>
          <p>
            The unchanged control gained {quality.control.extraCritical} critical warnings. This
            small synthetic evaluation measures policy application; it is not a fraud-accuracy score
            or a general retrieval benchmark. Retention is finite and provider availability can
            change.
          </p>
          <div className="proof-links">
            <a href={repo + 'evidence/judge-recall.json'} target="_blank" rel="noreferrer">
              Captured recall <ExternalLink size={13} />
            </a>
            <a href={repo + 'MEMORY_EVALUATION.md'} target="_blank" rel="noreferrer">
              Evaluation method & limits <ExternalLink size={13} />
            </a>
          </div>
        </section>
        <section id="chain" className="proof-section">
          <span className="site-eyebrow">03 / TATUM SUI MAINNET GRPC</span>
          <h2>
            Successful execution.
            <br />
            Correctly rejected invoice match.
          </h2>
          <p>
            Tatum returned a real finalized Mainnet transaction. The synthetic supplier recipient
            received no credit. A valid transaction alone cannot establish an invoice payment—or who
            owns the receiving wallet.
          </p>
          <dl className="proof-chain">
            <div>
              <dt>Actual digest</dt>
              <dd>
                <code>{chain.digest}</code>
              </dd>
            </div>
            <div>
              <dt>Checkpoint</dt>
              <dd>{chain.transaction.checkpoint}</dd>
            </div>
            <div>
              <dt>Execution</dt>
              <dd>{chain.transaction.effects.status.status}</dd>
            </div>
            <div>
              <dt>Sample expected credit</dt>
              <dd>500 SUI · {chain.expectedAtomic} integer units</dd>
            </div>
            <div>
              <dt>Actual sample-recipient credit</dt>
              <dd>0 SUI · {chain.receivedAtomic} integer units</dd>
            </div>
            <div>
              <dt>Result</dt>
              <dd className="amber-text">{chain.status}</dd>
            </div>
          </dl>
          <div className="proof-links">
            <a href={chain.explorer} target="_blank" rel="noreferrer">
              Inspect on SuiScan <ExternalLink size={13} />
            </a>
            <a href={repo + 'evidence/tatum-reconciliation.json'} target="_blank" rel="noreferrer">
              Recorded reconciliation <ExternalLink size={13} />
            </a>
          </div>
        </section>
        <section className="proof-section">
          <span className="site-eyebrow">04 / WHAT ISN’T CLAIMED</span>
          <h2>Evidence has boundaries.</h2>
          <ul>
            <li>
              Human confirmation is a reviewer’s assertion; PayGuard does not observe callbacks or
              certify supplier identity.
            </li>
            <li>The public demo creates no owner records and performs no Mainnet memory writes.</li>
            <li>
              No real positive supplier payment match is claimed by the unrelated test transaction.
            </li>
            <li>
              The separate x402 Testnet service flow is implemented and fixture-tested. No genuine
              service settlement is proven; Mainnet spending remains disabled.
            </li>
            <li>
              Wallet accounts use server-verified personal messages and isolated records.
              Administrator access remains separate.
            </li>
          </ul>
          <div className="proof-links">
            <a href={repo + 'AGENT_PAYMENTS.md'}>Payment pilot status</a>
            <a href="https://sopskistar.github.io/payguard-ai/">Published technical article</a>
          </div>
          <Link href="/try" className="button primary">
            See the evidence in the interactive demo <ArrowRight size={16} />
          </Link>
        </section>
        <LearningReport />
      </main>
      <footer className="site-footer-note">
        <Link href="/">PayGuard Verify</Link>
        <span>Published records · no customer information · no payment execution</span>
      </footer>
    </div>
  );
}
