'use client';
import Link from 'next/link';
import type { Snapshot } from '@/lib/types';
export function Onboarding({ data }: { data: Snapshot }) {
  const steps = [
    [
      'Create a supplier',
      '/app/vendors',
      'Add the business you expect to pay. Supplier identity remains your responsibility.',
      !!data.vendors?.length,
    ],
    [
      'Establish the reference',
      '/app/vendors',
      'Record the recipient and a contact obtained independently of the invoice.',
      data.vendorProfiles.length > 0,
    ],
    [
      'Add an invoice',
      '/app/invoices',
      'Enter or import an invoice. Review all extracted fields before saving.',
      data.invoices.length > 0,
    ],
    [
      'Inspect a change',
      '/app/review',
      'Compare the proposed recipient with your established supplier reference.',
      data.audit.some((e) => e.type === 'review.evaluated'),
    ],
    [
      'Verify independently',
      '/app/review',
      'Contact the supplier using the reference you already trust. Record the outcome.',
      data.audit.some((e) => e.type === 'instructions.human_verified'),
    ],
    [
      'Remember a correction',
      '/app/review',
      'Choose a narrow rule and consent to its minimized storage. Only a completed Walrus job counts.',
      data.memories.some((m) => m.status === 'confirmed'),
    ],
    [
      'Return and recall',
      '/app/memory',
      'Sign out and return. Run a new review with Memory ON, then inspect the cited blob.',
      data.usedMemoryIds.length > 0,
    ],
  ] as const;
  return (
    <section className="panel onboarding-panel">
      <div className="panel-top">
        <h2>Your first payment review</h2>
        <span className="badge">{steps.filter((s) => s[3]).length}/7 workspace milestones</span>
      </div>
      <p>
        Your wallet identifies your account. It does not verify a supplier or approve spending.
        These milestones reflect saved records; they are not a claim that a cross-session test has
        passed.
      </p>
      <ol className="onboarding-steps">
        {steps.map(([title, href, body, done], i) => (
          <li key={title}>
            <Link href={href}>
              {done ? '✓' : String(i + 1).padStart(2, '0')} · {title}
            </Link>
            <p>{body}</p>
          </li>
        ))}
      </ol>
      <Link className="inline-link" href="/try">
        Practice the full scenario with synthetic data first ↗
      </Link>
    </section>
  );
}
