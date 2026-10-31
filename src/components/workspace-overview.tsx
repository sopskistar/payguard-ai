'use client';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  FileText,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { Snapshot } from '@/lib/types';
import { Badge, Empty, money } from './ui';
import proof from '../../docs/evidence/provider-recheck.json';
import tenantProof from '../../docs/evidence/two-tenant-provider-recheck.json';
const names: Record<string, string> = {
  'invoice.created': 'Invoice added',
  'invoice.updated': 'Invoice edited',
  'invoice.approved': 'Review approved',
  'invoice.rejected': 'Invoice rejected',
  'review.evaluated': 'Invoice review recorded',
  'instructions.human_verified': 'Independent verification recorded',
  'instructions.updated': 'Payment instructions updated',
  'memory.confirmed': 'Walrus memory confirmed',
  'memory.recalled': 'Memory recalled',
  'integration.health': 'Integration diagnostics recorded',
  'wallet.refreshed': 'Watch-only balance refreshed',
  'payment.verification': 'Transaction reconciliation recorded',
  'payment.confirmed': 'Invoice payment matched',
};
export function WorkspaceOverview({
  data,
  onAdd,
  children,
}: {
  data: Snapshot;
  onAdd: () => void;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const sample = data.mode === 'public-demo';
  const open = data.invoices.filter((i) => i.status === 'open');
  const held = open.filter((i) => data.approvalGates?.[i.id]?.allowed === false);
  const confirmed = data.memories.filter((m) => m.status === 'confirmed');
  const latestMemory = confirmed
    .map((m) => m.completedAt)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);
  const next = held[0];
  const events = [...data.audit].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const health = data.audit
    .filter((e) => e.type === 'integration.health')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const tatum = health?.detail.tatum as { status?: string } | undefined;
  const status = sample
    ? 'Recorded proof available'
    : tatum?.status === 'Connected'
      ? 'Last check passed'
      : tatum?.status === 'Unavailable'
        ? 'Last check unavailable'
        : data.integrations.tatum
          ? 'Configured · not checked here'
          : 'Not configured';
  const metrics = [
    [
      'Invoices',
      String(data.invoices.length),
      `${open.length} open · ${data.invoices.filter((i) => i.isDemo).length} marked synthetic`,
      FileText,
    ],
    [
      'Approval holds',
      String(held.length),
      'Current instructions require verification',
      LockKeyhole,
    ],
    [
      'Trust references',
      String(data.vendorProfiles.length),
      'Human-established contacts, not identity proof',
      ShieldCheck,
    ],
  ] as const;
  return (
    <>
      <section className="work-next-action">
        <div>
          <span className="eyebrow">
            {sample ? 'SAMPLE WORKSPACE · PRACTICE ONLY' : 'YOUR NEXT REVIEW ACTION'}
          </span>
          <h2>
            {next
              ? 'A familiar supplier. An unresolved change.'
              : open.length
                ? 'Your next invoice is ready for review.'
                : 'Start with a supplier you know.'}
          </h2>
          <p>
            {next
              ? `${next.vendor} · ${next.number}: ${data.approvalGates?.[next.id]?.reason}`
              : 'Establish a supplier reference, add an invoice and inspect its instructions. No supplier payment is sent.'}
          </p>
        </div>
        <Link
          href={next ? `/app/review?invoice=${next.id}` : '/app/vendors'}
          className="button primary"
        >
          {next ? 'Inspect the held instruction' : 'Establish supplier instructions'}
          <ArrowRight size={16} />
        </Link>
      </section>
      <div className="work-metrics">
        {metrics.map(([label, value, caption, Icon]) => (
          <article key={label}>
            <span>
              <Icon size={17} />
              {label}
            </span>
            <strong>{value}</strong>
            <p>{caption}</p>
          </article>
        ))}
      </div>
      <div className="work-status-grid">
        <section className="panel work-memory-status">
          <div className="panel-top">
            <h2>
              <BrainCircuit size={18} />{' '}
              {sample ? 'Mainnet proof, kept separate' : 'Your confirmed policy memory'}
            </h2>
            <Badge tone="cyan">Walrus</Badge>
          </div>
          <div className="work-proof-count">
            <strong>
              {sample
                ? proof.confirmed +
                  tenantProof.additionalChecks.filter(
                    (c) => c.providerStatus === 'done' && c.matchingBlob && c.matchingNamespace,
                  ).length
                : confirmed.length}
            </strong>
            <span>
              {sample
                ? 'tracked confirmed Mainnet records'
                : 'completed provider jobs in this workspace'}
              <small>
                {sample
                  ? '30 owner + 2 controlled customer scopes'
                  : `${data.memories.filter((m) => ['pending', 'queued'].includes(m.status)).length} pending · ${data.memories.filter((m) => m.status === 'failed').length} failed`}
              </small>
            </span>
          </div>
          <p>
            {sample
              ? 'There are no personal memories in this public sample. These receipts belong to the separate published experiment.'
              : 'Only confirmed, owned and applicable recalled policies can inform a later review. Stored memories do not waive hard approval checks.'}
          </p>
          <p className="work-evidence-time">
            {sample ? (
              <>
                Provider evidence checked{' '}
                <time dateTime={proof.checkedAt}>
                  {new Date(proof.checkedAt).toLocaleDateString()}
                </time>
              </>
            ) : latestMemory ? (
              <>
                Last completed write{' '}
                <time dateTime={latestMemory}>{new Date(latestMemory).toLocaleString()}</time>
              </>
            ) : (
              'No completed write in this workspace yet.'
            )}
          </p>
          <Link className="inline-link" href={sample ? '/proof#memory' : '/app/memory'}>
            {sample ? 'Inspect published Mainnet proof' : 'Open Memory Lab'}
            <ArrowUpRight size={14} />
          </Link>
        </section>
        <section className="panel work-chain-status">
          <div className="panel-top">
            <h2>
              <ShieldCheck size={18} /> Transaction evidence
            </h2>
            <Badge>Tatum · Sui</Badge>
          </div>
          <strong className="work-chain-state">{status}</strong>
          <p>
            {sample
              ? 'A genuine Mainnet transaction executed, but did not pay the sample recipient. The recorded reconciliation correctly says Mismatch.'
              : 'A configured key is not a successful connection check. Diagnostics record a dated live read; invoice reconciliation separately checks the exact recipient, asset and amount.'}
          </p>
          <p className="work-evidence-time">
            {health ? (
              <>
                Last diagnostic{' '}
                <time dateTime={health.createdAt}>
                  {new Date(health.createdAt).toLocaleString()}
                </time>
              </>
            ) : sample ? (
              'Open the proof to inspect its capture date and digest.'
            ) : (
              'No saved integration diagnostic in the latest activity window.'
            )}
          </p>
          <Link
            className="inline-link"
            href={sample ? '/proof#chain' : '/app/settings/integrations'}
          >
            {sample ? 'Inspect the captured transaction' : 'Run connection diagnostics'}
            <ArrowUpRight size={14} />
          </Link>
        </section>
      </div>
      <div className="work-review-grid">
        <section className="panel">
          <div className="panel-top">
            <h2>
              Instructions awaiting verification <span className="count-pill">{held.length}</span>
            </h2>
            <Link href="/app/review" className="inline-link">
              Review center <ArrowUpRight size={14} />
            </Link>
          </div>
          {held.length ? (
            held.slice(0, 4).map((i) => (
              <Link className="work-queue-row" key={i.id} href={`/app/review?invoice=${i.id}`}>
                <span className="work-queue-symbol">
                  <LockKeyhole size={17} />
                </span>
                <div>
                  <strong>{i.vendor}</strong>
                  <small>
                    {i.number}
                    {i.isDemo && ' · synthetic'}
                  </small>
                  <p>{data.approvalGates?.[i.id]?.reason}</p>
                </div>
                <span>
                  {money(i)}
                  <ArrowRight size={14} />
                </span>
              </Link>
            ))
          ) : (
            <Empty title="No open approval holds">
              <p>
                Current gates are evaluated from the instruction and human verification records, not
                the risk score.
              </p>
            </Empty>
          )}
        </section>
        <section className="panel work-activity">
          <div className="panel-top">
            <h2>
              <Activity size={18} /> Recent workspace activity
            </h2>
            <Link href="/app/activity" className="inline-link">
              Audit <ArrowUpRight size={14} />
            </Link>
          </div>
          <p className="work-activity-label">
            {sample
              ? 'Public practice does not write an audit log.'
              : 'Saved application events · synthetic exercises may be included.'}
          </p>
          {events.length ? (
            <ol>
              {events.map((e) => {
                const invoice = data.invoices.find((i) => i.id === e.entityId);
                return (
                  <motion.li key={e.id} initial={false} animate={{ opacity: 1 }} layout={!reduced}>
                    <span />
                    <div>
                      <strong>
                        {names[e.type] || e.type.replaceAll('.', ' / ').replaceAll('_', ' ')}
                      </strong>
                      {invoice && (
                        <p>
                          {invoice.number}
                          {invoice.isDemo && ' · synthetic'}
                        </p>
                      )}
                      <time dateTime={e.createdAt}>{new Date(e.createdAt).toLocaleString()}</time>
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          ) : (
            <div className="work-activity-empty">
              <FileText size={24} />
              <h3>
                {sample
                  ? 'Explore an auditable practice decision.'
                  : 'Your work will leave a trail.'}
              </h3>
              <p>
                {sample
                  ? 'The guided demo keeps a clearly labeled local practice log. Private owner activity stays private.'
                  : 'Invoice changes, independent checks and review outcomes appear here after they are saved.'}
              </p>
              <Link href={sample ? '/try' : '/app/activity'} className="inline-link">
                {sample ? 'Open the guided demo' : 'Open Activity & Audit'}
                <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </section>
      </div>
      <section className="panel">
        <div className="panel-top">
          <h2>Recent invoices</h2>
          <Link className="inline-link" href="/app/invoices">
            View all <ArrowUpRight size={15} />
          </Link>
        </div>
        {children}
        {!data.invoices.length && (
          <Empty title="Your inbox starts here">
            <button className="button primary" onClick={onAdd}>
              Add your first invoice
            </button>
          </Empty>
        )}
      </section>
      <p className="work-operational-note">
        Snapshot data refreshes on request. This view does not poll paid providers or simulate new
        activity. <Link href="/services">Agent Services</Link> are supplemental analysis, separate
        from supplier payments.
      </p>
    </>
  );
}

const help: Record<string, [string, string, string]> = {
  overview: [
    'How this workspace works',
    'Start with an established supplier contact, inspect the invoice’s recipient, and record an independent check before approving a changed instruction.',
    'Approval holds come from current saved instructions. A risk score, wallet address or remembered rule is not supplier identity.',
  ],
  invoices: [
    'What belongs in the Invoice Inbox?',
    'Add a structured invoice or import a text-based document. Check extracted fields before saving. Original documents never become Walrus memory.',
    'Public practice is read-only. Private mutations require a verified account or administrator session.',
  ],
  review: [
    'What does Verify Instructions do?',
    'Compare the new recipient against the established reference, then record the outcome of a call, in-person check or established portal.',
    'Use a contact obtained before the suspicious request. Changing payment terms invalidates the previous attestation.',
  ],
  vendors: [
    'What does Vendor Trust mean?',
    'A supplier profile records the destination and independent contact you established. It is a human-sourced review reference.',
    'A valid wallet address or transaction cannot independently prove the supplier’s identity.',
  ],
  replay: [
    'What does the Attack Replay Lab demonstrate?',
    'Synthetic attacks show how changed recipients, urgency, lookalike senders and malicious document instructions affect the actual review rules.',
    'Replay controls do not send payments or alter private records.',
  ],
  wallets: [
    'What can Wallet Watch verify?',
    'Add a watch-only address and inspect a real transaction digest through Tatum. Reconciliation checks final execution and exact recipient credit.',
    'A transaction can succeed and still fail this invoice’s payment check. Watching a wallet grants no spending permission.',
  ],
  memory: [
    'What does Memory Lab remember?',
    'Only minimized, consented review policies belong in Walrus. Completed jobs have genuine blob evidence; later recall must match your owned policy and scope.',
    'Memory OFF removes learned context, never hard verification requirements. Private invoice documents and secrets do not belong in memory.',
  ],
  activity: [
    'What does Activity & Audit record?',
    'Saved imports, changes, review decisions, provider outcomes and corrections form an append-only application history.',
    'Public practice cannot read the owner’s private history. Recorded timestamps identify when each actual event occurred.',
  ],
  settings: [
    'How do workspace settings affect reviews?',
    'Review thresholds and preferences guide the deterministic assessment. Integration diagnostics are deliberate live reads with dated results.',
    'Agent Services is a separate, capped purchase workflow. Production signing and settlement remain security-paused.',
  ],
  'settings/integrations': [
    'What does a connection check prove?',
    'Diagnostics make actual provider requests. Configuration alone is not a healthy connection, and chain connectivity is not payment reconciliation.',
    'Run a check when needed. Production financial signing remains paused; the supervised owner-local workflow requires separate approval for each purchase.',
  ],
};
export function WorkspaceGuide({ view }: { view: string }) {
  const content = help[view];
  if (!content) return null;
  return (
    <details className="work-context-help">
      <summary>{content[0]}</summary>
      <div>
        <p>{content[1]}</p>
        <p>{content[2]}</p>
      </div>
    </details>
  );
}
