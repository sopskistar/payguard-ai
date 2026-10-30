'use client';
import Link from 'next/link';
import { useState } from 'react';
import { BrainCircuit, ArrowRight, Check, LockKeyhole } from 'lucide-react';
import proof from '../../docs/evidence/walrus-confirmed.json';
import recorded from '../../docs/evidence/judge-recall.json';
import { judgeReview } from '@/lib/judge';
import type { Policy } from '@/lib/types';
export const publishedMemoryCount = proof.confirmedMemories.length;
export function PublicMemoryLab() {
  const [on, setOn] = useState(false);
  const assessment = judgeReview(on, recorded.policies as Policy[], recorded.citations).assessment;
  return (
    <div className="public-memory-lab">
      <section className="panel public-memory-hero">
        <div>
          <span className="eyebrow">PUBLISHED MAINNET EVIDENCE</span>
          <h2>
            Memory works across sessions.
            <br />
            This demo keeps your data separate.
          </h2>
          <p>
            The public workspace uses synthetic invoices and creates no private memories. The owner
            collection has {publishedMemoryCount} confirmed Walrus Mainnet records. Two additional
            controlled customer records bring the tracked total to 32; all are separate from your
            personal data.
          </p>
          <Link className="button primary" href="/proof#memory">
            Inspect {publishedMemoryCount} confirmed receipts <ArrowRight size={16} />
          </Link>
        </div>
        <div className="public-memory-number">
          <BrainCircuit size={25} />
          <strong>{publishedMemoryCount}</strong>
          <span>
            confirmed records
            <br />
            in the published proof set
          </span>
        </div>
      </section>
      <section className="panel">
        <div className="panel-top">
          <h2>A correction, recovered later</h2>
          <span className="badge cyan">Recorded real recall</span>
        </div>
        <ol className="memory-proof-timeline">
          <li>
            <Check size={16} />
            <div>
              <strong>A human corrects a review.</strong>
              <p>
                Synthetic business event: recipient changes require the established supplier
                channel.
              </p>
            </div>
          </li>
          <li>
            <Check size={16} />
            <div>
              <strong>Walrus confirms the memory write.</strong>
              <p>The accepted job completes and its actual blob ID is saved in Neon.</p>
            </div>
          </li>
          <li>
            <Check size={16} />
            <div>
              <strong>A fresh authenticated session recalls it.</strong>
              <p>
                The actual SDK result cites the confirmed blob and adds the remembered escalation
                procedure.
              </p>
            </div>
          </li>
        </ol>
        <div className="public-memory-toggle">
          <div>
            <strong>Later Northstar invoice</strong>
            <p>Recorded capture: {recorded.capturedAt.slice(0, 10)}. No live query is made here.</p>
          </div>
          <div className="segmented">
            <button aria-pressed={!on} className={!on ? 'active' : ''} onClick={() => setOn(false)}>
              Memory OFF
            </button>
            <button
              aria-pressed={on}
              className={on ? 'active mint-active' : ''}
              onClick={() => setOn(true)}
            >
              Memory ON
            </button>
          </div>
        </div>
        <div className="public-memory-result" aria-live="polite">
          <strong>{assessment.level}</strong>
          <p>
            {on
              ? `${assessment.citations.length} applicable confirmed citations add the owner-approved procedure. Baseline verification checks remain.`
              : 'The changed-recipient warning remains. Learned soft policies are excluded.'}
          </p>
          {on && <code>{assessment.citations[0]?.blobId}</code>}
        </div>
        <Link className="inline-link" href="/try">
          Follow the complete interactive demo <ArrowRight size={15} />
        </Link>
      </section>
      <section className="panel public-owner-explainer">
        <LockKeyhole size={21} />
        <div>
          <h2>Owner mode runs live operations.</h2>
          <p>
            Authenticated owner reviews save real decisions, write minimized policies to Walrus and
            query Tatum. Connect Sui Wallet opens a separate personal account after signature
            verification. The public demo never writes private records. Wallet Watch is read-only.
          </p>
          <Link className="inline-link" href="/app?signin=1">
            Owner Sign In <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </div>
  );
}
