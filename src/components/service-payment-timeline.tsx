type Progress = {
  prepared?: { digest: string } | null;
  executionDigest?: string | null;
  submitted?: boolean;
  confirming?: boolean;
  diagnostic?: { stage: string; code: string; message: string; checkedAt: string } | null;
};
export function ServicePaymentTimeline({
  quoteId,
  preparedDigest,
  phase,
  progress,
  receipt,
}: {
  quoteId: string;
  preparedDigest?: string;
  phase: string;
  progress?: Progress;
  receipt?: Record<string, unknown>;
}) {
  const settled = !!receipt;
  const entries = [
    [
      'Prepared',
      preparedDigest || progress?.prepared ? 'Complete · unsigned bytes saved' : 'Not reached',
    ],
    [
      'Awaiting signature',
      phase === 'awaiting-wallet'
        ? 'Current · inspect Slush'
        : phase === 'wallet-error'
          ? 'Stopped · wallet error'
          : progress?.executionDigest || settled
            ? 'Complete'
            : 'Not reached',
    ],
    [
      'Submitted',
      progress?.submitted || settled
        ? 'Submission recorded'
        : phase === 'submission-uncertain'
          ? 'Uncertain · resume original payment'
          : 'Not reached',
    ],
    [
      'Confirming',
      settled
        ? 'Complete · Tatum finalized'
        : phase === 'failed'
          ? 'Complete · execution failed; no service receipt'
          : progress?.confirming
            ? 'Current · Tatum reconciliation'
            : 'Not reached',
    ],
    ['Settled', settled ? 'Complete · verified merchant credit' : 'Not confirmed'],
    ['Report delivered', receipt?.result ? 'Complete · report persisted' : 'Not delivered'],
  ];
  return (
    <section className="notice service-prepared-digest" aria-label="Payment status timeline">
      <h3>Payment progress</h3>
      <p>
        Quote ID: <code>{quoteId}</code>
      </p>
      <p>
        Prepared digest:{' '}
        <code>{preparedDigest || progress?.prepared?.digest || 'Not prepared'}</code>
      </p>
      <p>
        Execution digest:{' '}
        <code>
          {progress?.executionDigest || String(receipt?.digest || 'No signed submission received')}
        </code>
      </p>
      <ol>
        {entries.map(([label, status]) => (
          <li key={label}>
            <strong>{label}</strong> · {status}
          </li>
        ))}
      </ol>
      {!settled && (
        <p>
          A prepared digest is calculated locally. A signed or submitted digest is not a receipt
          either. SuiScan may not show it until execution; only finalized Tatum merchant-credit
          verification confirms payment.
        </p>
      )}
      {progress?.diagnostic && (
        <p role="alert">
          {progress.diagnostic.stage} · {progress.diagnostic.code}: {progress.diagnostic.message} (
          {progress.diagnostic.checkedAt})
        </p>
      )}
    </section>
  );
}
