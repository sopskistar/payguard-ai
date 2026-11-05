'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  APPROVED_SERVICE_RECOVERIES,
  type ControlledRecoveryStatus,
} from '@/lib/approved-service-recoveries';
import { Badge } from './ui';

export function HistoricalServiceRecovery({
  payer,
  audience,
  onBlockedChange,
  onVerified,
}: {
  payer: string | null;
  audience: 'owner' | 'customer';
  onBlockedChange: (blocked: boolean) => void;
  onVerified: () => Promise<void>;
}) {
  const role = audience === 'customer' ? 'member' : 'owner';
  const relevant = APPROVED_SERVICE_RECOVERIES.some((r) => r.role === role && r.payer === payer);
  const scope = role + ':' + payer;
  const key = 'payguard:controlled-recovery-pending:' + scope;
  const [status, setStatus] = useState<ControlledRecoveryStatus>();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const lock = useRef(false);
  const active = useRef(true);
  const inspect = useCallback(async () => {
    const response = await fetch('/api/service-payments/recovery', {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw Error(
        'The original records could not be verified. Recovery and new checkout remain stopped.',
      );
    const current: ControlledRecoveryStatus = await response.json();
    if (!active.current) throw Error('The workspace view changed.');
    if (current.scope !== null && current.scope !== scope)
      throw Error('The signed-in workspace changed. No recovery request was sent.');
    setStatus(current);
    onBlockedChange(
      !!current.records.length && (current.enabled || !current.verified || !!current.nextId),
    );
    return current;
  }, [scope, onBlockedChange]);
  useEffect(() => {
    active.current = true;
    const timer = setTimeout(() => {
      if (!relevant) {
        onBlockedChange(false);
        return;
      }
      onBlockedChange(true);
      setStatus(undefined);
      setFailure('');
      setConfirmed(false);
      let previous: string | null = null;
      try {
        previous = localStorage.getItem(key);
      } catch {
        setFailure('Browser recovery tracking is unavailable. No recovery can be started.');
        return;
      }
      setPendingId(previous);
      void inspect()
        .then((current) => {
          if (
            previous &&
            !current.enabled &&
            current.verified &&
            current.records.some((r) => r.id === previous && r.recoveredVerified)
          ) {
            localStorage.removeItem(key);
            setPendingId(null);
          } else if (previous) {
            setFailure(
              'A previous recovery request needs review. Do not retry it or recover another intent. Close the recovery window and reconcile its persisted result.',
            );
            onBlockedChange(true);
          }
        })
        .catch(() => {
          if (!active.current) return;
          setFailure('Recovery status is unavailable. New checkout and recovery remain stopped.');
          onBlockedChange(true);
        });
    }, 0);
    return () => {
      active.current = false;
      clearTimeout(timer);
    };
  }, [relevant, inspect, key, onBlockedChange]);
  async function recover() {
    if (
      lock.current ||
      !confirmed ||
      !status?.nextId ||
      !status.enabled ||
      !status.verified ||
      pendingId ||
      failure
    )
      return;
    lock.current = true;
    setBusy(true);
    setConfirmed(false);
    const id = status.nextId;
    let sent = false;
    try {
      const fresh = await inspect();
      if (!fresh.enabled || !fresh.verified || fresh.nextId !== id || fresh.scope !== scope)
        throw Error('The record or workspace changed. No recovery request was sent.');
      localStorage.setItem(key, id);
      setPendingId(id);
      sent = true;
      const response = await fetch('/api/service-payments/' + id + '/recover-expired', {
        method: 'POST',
        credentials: 'same-origin',
        redirect: 'error',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmRecovery: true }),
        signal: AbortSignal.timeout(65000),
      });
      const outcome = await response.json();
      // Even a successful HTTP response is not the verification step.
      const persisted = await inspect();
      const original = persisted.records.find((r) => r.id === id);
      const expected = APPROVED_SERVICE_RECOVERIES.find((r) => r.id === id);
      if (
        !expected ||
        !response.ok ||
        !outcome.recovered ||
        outcome.state !== 'expired-unexecuted' ||
        outcome.releasedAtomic !== expected?.amountAtomic ||
        outcome.preparedDigest !== expected?.digest ||
        !persisted.verified ||
        !original?.recoveredVerified ||
        !original.auditId ||
        original.releasedAtomic !== expected.amountAtomic
      )
        throw Error('The recovery did not pass independent persisted verification.');
      await onVerified();
      localStorage.removeItem(key);
      setPendingId(null);
    } catch {
      setFailure(
        sent
          ? 'STOP: this request needs review. Do not retry or continue. Disable recovery in Vercel and redeploy, then reconcile the persisted state and audit.'
          : 'The precheck did not complete. No recovery request was sent. Refresh status before proceeding.',
      );
      if (active.current) onBlockedChange(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function refresh() {
    if (lock.current) return;
    setBusy(true);
    try {
      const current = await inspect();
      // Reading can confirm a completed request, but never repeats a POST.
      if (
        pendingId &&
        !current.enabled &&
        current.verified &&
        current.records.some((r) => r.id === pendingId && r.recoveredVerified)
      ) {
        localStorage.removeItem(key);
        setPendingId(null);
        setFailure('');
        await onVerified();
      } else if (!pendingId) setFailure('');
    } catch {
      setFailure('Status could not be verified. Keep recovery and checkout stopped.');
      onBlockedChange(true);
    } finally {
      setBusy(false);
    }
  }
  if (!relevant || (status && !status.records.length)) return null;
  const next = status?.records.find((r) => r.id === status.nextId);
  const stopped = !!failure || !!pendingId || !status?.verified;
  return (
    <section className="notice" aria-label="Historical payment recovery">
      <div style={{ minWidth: 0, width: '100%', overflowWrap: 'anywhere' }}>
        <h2>Resolve historical payment holds</h2>
        <Badge tone={status?.enabled ? 'amber' : 'mint'}>
          {status
            ? `Recovery window ${status.enabled ? 'enabled' : 'disabled'}`
            : 'Checking original records…'}
        </Badge>
        <p>
          Only the approved original attempts in this signed-in workspace appear here. Each
          confirmation releases an accounting hold after fresh independent server checks. No wallet
          signature or transfer is requested.
        </p>
        {status?.records.map((record) => (
          <div key={record.id} className="field" style={{ marginBlock: '1rem' }}>
            <strong>
              {record.recoveredVerified
                ? 'Recovered · audit and accounting verified'
                : record.state === 'approved'
                  ? 'Historical reservation · 0.001 SUI'
                  : 'Review required'}
            </strong>
            <span>
              Original intent: <code>{record.id}</code>
            </span>
            <span>
              Recorded payer: <code>{record.payer}</code>
            </span>
            <span>
              Original digest: <code>{record.digest}</code>
            </span>
            {record.auditId && (
              <span>
                Recovery audit: <code>{record.auditId}</code> · released 0.001 SUI
              </span>
            )}
            {!!record.issues.length && (
              <span role="alert">Stopped: {record.issues.join(', ')}</span>
            )}
          </div>
        ))}
        {status?.wallet && (
          <p>
            Workspace reservation:{' '}
            <strong>{(Number(status.wallet.reservedAtomic) / 1e9).toFixed(3)} SUI</strong> ·
            liability verified
          </p>
        )}
        {status?.sponsor && (
          <p>
            Public sponsor reservation:{' '}
            <strong>{(Number(status.sponsor.reservedAtomic) / 1e9).toFixed(3)} SUI</strong> ·
            liability verified
          </p>
        )}
        {!!status?.issues.length && <p role="alert">Stopped: {status.issues.join(', ')}</p>}
        {failure && <p role="alert">{failure}</p>}
        {next && !stopped && status?.enabled && (
          <>
            <label className="check">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={busy}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I confirm recovery of original {next.id} only, releasing at most 0.001 SUI of its
              accounting reservation.
            </label>
            <button
              className="button primary"
              disabled={!confirmed || busy}
              onClick={() => void recover()}
            >
              {busy ? 'Verifying original and persisted result…' : 'Recover this original hold'}
            </button>
          </>
        )}
        {status && !status.nextId && status.verified && (
          <p role="status">
            All historical holds in this workspace have verified recovery audits. New checkout stays
            stopped until the recovery window is disabled. Other workspaces keep their own holds.
          </p>
        )}
        {status?.verified &&
          !status.enabled &&
          !status.nextId &&
          !pendingId &&
          !failure &&
          audience === 'customer' && (
            <p>
              <a className="button primary" href="/services?invoice=PG-TEST-1103-01">
                Open Harborline checkout · exact approval required
              </a>
            </p>
          )}
        {!status?.enabled && next && (
          <p>The recovery window is disabled. No reservation can be released here.</p>
        )}
        <p>
          <button className="button outline" disabled={busy} onClick={() => void refresh()}>
            Refresh recovery status · read only
          </button>
        </p>
      </div>
    </section>
  );
}
