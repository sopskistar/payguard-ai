'use client';
import Link from 'next/link';
import { useClientReady } from './client-ready';
import { WalletSessionMonitor } from './wallet-entry';
import { Onboarding } from './onboarding';
import { PublicMemoryLab, publishedMemoryCount } from './mode-notice';
import { VerificationPanel, VendorProfiles, AttackReplayLab } from './verify-panels';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useRef, type FormEvent, type ReactNode } from 'react';
import { motion, MotionConfig } from 'motion/react';
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleHelp,
  FileText,
  Fingerprint,
  FlaskConical,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wallet,
  X,
  Zap,
  AlertTriangle,
  ExternalLink,
  Pencil,
} from 'lucide-react';
import type { Snapshot, Invoice, Assessment, Citation, MemoryJobView } from '@/lib/types';
import type { ChainTransaction, Verification } from '@/lib/integrations/tatum';
import {
  api,
  Badge,
  Empty,
  Field,
  FindingList,
  Modal,
  money,
  RiskBadge,
  short,
  Submit,
} from './ui';
import { InvoiceForm, CorrectionForm } from './forms';
const nav = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'invoices', label: 'Invoice Inbox', icon: FileText },
  { id: 'review', label: 'Verify Instructions', icon: ShieldCheck },
  { id: 'vendors', label: 'Vendor Trust', icon: Fingerprint },
  { id: 'replay', label: 'Attack Replay Lab', icon: FlaskConical },
  { id: 'wallets', label: 'Wallet Watch', icon: Wallet },
  { id: 'memory', label: 'Memory Lab', icon: BrainCircuit },
  { id: 'activity', label: 'Activity & Audit', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];
const subtitles: Record<string, string> = {
  vendors: 'Established recipients. Independent contacts. Human accountability.',
  replay: 'Replay documented instruction attacks with transparent evidence.',
  overview: 'Verify the instruction before trusting the payment.',
  invoices: 'Your invoices, organized and ready for review.',
  review: 'Follow the evidence. Make the final call.',
  wallets: 'Watch-only wallets. Real Sui Mainnet evidence.',
  memory: 'Every correction makes the next review more informed.',
  activity: 'A traceable record of what happened and why.',
  settings: 'Your workspace. Your review rules.',
  'settings/integrations': 'Connection diagnostics, configuration and proof.',
};
type Toast = { text: string; error: boolean };
export function Workspace({
  view,
  initialInvoice,
  initialSignIn = false,
}: {
  view: string;
  initialInvoice?: string;
  initialSignIn?: boolean;
}) {
  const router = useRouter();
  const ready = useClientReady();
  const [data, setData] = useState<Snapshot>();
  const snapshotGeneration = useRef(0);
  const privacyLock = useRef(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string>();
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState<Toast>();
  const [modal, setModal] = useState<'login' | 'invoice' | 'correction' | 'status' | null>(
    initialSignIn ? 'login' : null,
  );
  const [edit, setEdit] = useState<Invoice>();
  const [selected, setSelected] = useState(initialInvoice || '');
  const [comparisons, setComparisons] = useState<
    Record<string, { on?: Assessment; off?: Assessment }>
  >({});
  const [memoryOn, setMemoryOn] = useState(true);
  const notify = useCallback((text: string, error = false) => setToast({ text, error }), []);
  const refresh = useCallback(
    async (feedback = false) => {
      if (privacyLock.current) return false;
      const generation = snapshotGeneration.current;
      setRefreshing(true);
      try {
        const snapshot = await api<Snapshot>('snapshot');
        if (generation !== snapshotGeneration.current || privacyLock.current) return false;
        setData(snapshot);
        setLoadError('');
        setLastRefresh(new Date().toISOString());
        if (feedback)
          notify(
            snapshot.mode === 'public-demo'
              ? 'Sample data is up to date.'
              : 'Your workspace is up to date.',
          );
        return true;
      } catch (e) {
        if (generation !== snapshotGeneration.current || privacyLock.current) return false;
        const message = (e as Error).message;
        setLoadError(message);
        if (feedback) notify('Refresh failed. ' + message, true);
        return false;
      } finally {
        setRefreshing(false);
      }
    },
    [notify],
  );
  useEffect(() => {
    let active = true;
    const generation = snapshotGeneration.current;
    void api<Snapshot>('snapshot')
      .then((value) => {
        if (active && generation === snapshotGeneration.current && !privacyLock.current) {
          setData(value);
          setLastRefresh(new Date().toISOString());
        }
      })
      .catch((error) => {
        if (active && generation === snapshotGeneration.current && !privacyLock.current)
          setLoadError(error.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(undefined), 8000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const owner = !!data && data.mode !== 'public-demo';
  const invoice = selected ? data?.invoices.find((i) => i.id === selected) : data?.invoices[0];
  const assessment = invoice
    ? comparisons[invoice.id]?.[memoryOn ? 'on' : 'off'] || data?.assessments[invoice.id]
    : undefined;
  const act = useCallback(
    async <T,>(path: string, payload?: unknown, message?: string): Promise<T | undefined> => {
      setBusy(true);
      const signingOut = path === 'auth/logout';
      if (signingOut) {
        snapshotGeneration.current++;
        privacyLock.current = true;
        setLogoutPending(true);
        setData(undefined);
        setComparisons({});
        setSelected('');
      }
      try {
        const r = await api<T>(path, payload);
        if (signingOut) {
          privacyLock.current = false;
          setLogoutPending(false);
        }
        const refreshed = await refresh();
        if (!refreshed)
          notify(
            'The action completed, but the workspace could not refresh. Retry Refresh to load current records.',
            true,
          );
        else if (message) notify(message);
        return r;
      } catch (e) {
        notify((e as Error).message, true);
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [notify, refresh],
  );
  useEffect(() => {
    const changed = () => {
      // Lock immediately, including when logout is interrupted. Never wait for another session read.
      void act('auth/logout', {}, 'Wallet changed; sign in again.').then((result) => {
        if (result) router.replace('/connect?changed=1');
      });
    };
    window.addEventListener('payguard:wallet-session-changed', changed);
    return () => window.removeEventListener('payguard:wallet-session-changed', changed);
  }, [act, router]);
  async function recheck(on = memoryOn) {
    if (!invoice) return;
    if (!owner) {
      setMemoryOn(on);
      notify(
        on
          ? 'Public sample: live recall requires sign-in. Connect a wallet or use Owner Sign In. The baseline remains unchanged.'
          : 'Memory OFF: deterministic baseline only.',
      );
      return;
    }
    const r = await act<Assessment>('review', { invoiceId: invoice.id, memoryOn: on });
    if (r) {
      setComparisons((prev) => ({
        ...prev,
        [invoice.id]: { ...prev[invoice.id], [on ? 'on' : 'off']: r },
      }));
      setMemoryOn(on);
    }
  }
  function openInvoice(i?: Invoice) {
    if (!owner) {
      setModal('login');
      return;
    }
    setEdit(i);
    setModal('invoice');
  }
  const pageTitle =
    view === 'settings/integrations'
      ? 'Integration diagnostics'
      : nav.find((n) => n.id === view)?.label || 'Overview';
  if (logoutPending)
    return (
      <main id="main" className="workspace-loading">
        <h1>Private data hidden</h1>
        <p role="status">
          {busy
            ? 'Confirming sign-out with the server…'
            : 'Sign-out could not be confirmed. Your private data stays hidden here. Retry to revoke the server session.'}
        </p>
        <button
          className="button outline"
          disabled={busy}
          onClick={() => void act('auth/logout', {}, 'Signed out.')}
        >
          Retry sign-out
        </button>
      </main>
    );
  if (!ready)
    return (
      <main id="main" className="workspace-loading">
        <img src="/brand/icon.png" alt="PayGuard shield" width={44} height={44} />
        <h1>Preparing your workspace</h1>
        <noscript>Enable JavaScript to use the private workspace.</noscript>
        <p role="status">
          Loading the controls for your account. If this takes longer than expected, reload the
          workspace and check your connection.
        </p>
        <form action={view === 'overview' ? '/app' : `/app/${view}`} method="get">
          <button className="button outline" type="submit">
            Reload workspace
          </button>
        </form>
        <Link href="/try" className="inline-link">
          Try the public interactive demo ↗
        </Link>
      </main>
    );
  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <aside className={`sidebar ${drawer ? 'open' : ''}`}>
          <Link className="sidebar-brand" href="/">
            <img src="/brand/icon.png" alt="PayGuard shield" />
            <span>
              PayGuard<span>Verify</span>
            </span>
          </Link>
          <div className="workspace-label">
            <span className="workspace-avatar">P</span>
            <div>
              PayGuard workspace
              <small>
                {data?.mode === 'member'
                  ? 'Your wallet workspace'
                  : owner
                    ? 'Owner workspace'
                    : 'Public guided demo'}
              </small>
            </div>
            <span className="tiny-dot" />
          </div>
          <p className="nav-label">WORKSPACE</p>
          <nav aria-label="Main navigation">
            {nav.map((n) => (
              <Link
                key={n.id}
                href={n.id === 'overview' ? '/app' : `/app/${n.id}`}
                onClick={() => setDrawer(false)}
                className={`nav-link ${view === n.id || (n.id === 'settings' && view.startsWith('settings/')) ? 'active' : ''}`}
              >
                <n.icon size={19} />
                <span>{n.label}</span>
                {n.id === 'review' && data && (
                  <span className="nav-count">
                    {data.invoices.filter((i) => i.status === 'open').length}
                  </span>
                )}
                {n.id === 'memory' && <span className="new-label">LEARN</span>}
              </Link>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="guardian-mini">
              <span className="guardian-orb">
                <ShieldCheck size={20} />
              </span>
              <strong>You make the final call.</strong>
              <p>
                PayGuard reviews evidence.
                <br />
                It never moves your funds.
              </p>
              <Link href="/app/memory">
                Explore the learning loop <ArrowUpRight size={14} />
              </Link>
            </div>
            <button
              className="nav-link account-button"
              onClick={() =>
                owner ? void act('auth/logout', {}, 'Signed out.') : setModal('login')
              }
            >
              {owner ? <LogOut size={18} /> : <LogIn size={18} />}
              <span>{owner ? 'Sign out' : 'Owner login'}</span>
              <LockKeyhole size={14} />
            </button>
          </div>
        </aside>
        {drawer && (
          <button
            className="drawer-scrim"
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
          />
        )}
        <div className="app-main">
          <header className="topbar">
            <div>
              <button
                className="icon-button mobile-menu"
                aria-label="Open navigation"
                onClick={() => setDrawer(!drawer)}
              >
                <Menu />
              </button>
              <span className="breadcrumb">
                Workspace <ChevronRight size={13} /> <strong>{pageTitle}</strong>
              </span>
            </div>
            <div className="topbar-right">
              <span className="network-label">
                <span className="status-dot" /> Sui Mainnet
              </span>
              <Link className="icon-button" href="/app/activity" aria-label="View activity">
                <Bell size={18} />
              </Link>
              <button
                className="user-avatar"
                aria-label={owner ? 'Owner settings' : 'Owner login'}
                onClick={() => (owner ? router.push('/app/settings') : setModal('login'))}
              >
                {owner ? 'O' : 'D'}
              </button>
            </div>
          </header>
          <main id="main" className="workspace-content">
            <div className="page-heading">
              <div>
                <span className="eyebrow">YOUR PAYMENT COMMAND CENTER</span>
                <h1>
                  {pageTitle}
                  {view === 'overview' && <span className="title-dot">.</span>}
                </h1>
                <p>{subtitles[view]}</p>
              </div>
              <div className="page-actions">
                <button
                  className="button outline small"
                  onClick={() => void refresh(true)}
                  aria-label="Refresh workspace"
                  aria-busy={refreshing}
                  disabled={busy || refreshing}
                >
                  <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
                  <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
                </button>
                {['overview', 'invoices'].includes(view) && (
                  <button
                    className="button primary small"
                    title={
                      owner ? 'Add a private invoice' : 'Owner sign-in is required to add invoices'
                    }
                    onClick={() => openInvoice()}
                  >
                    <Plus size={17} /> Add invoice
                  </button>
                )}
              </div>
            </div>
            {lastRefresh && (
              <p className="workspace-refresh-time">
                {refreshing ? 'Checking for current data…' : 'Last successful refresh: '}
                <time dateTime={lastRefresh}>{new Date(lastRefresh).toLocaleTimeString()}</time>
              </p>
            )}
            {data?.mode === 'member' && (
              <>
                <WalletSessionMonitor expectedAddress={data.identity?.walletAddress || ''} />
                {view === 'overview' && <Onboarding data={data} />}
              </>
            )}
            {data?.mode === 'public-demo' && (
              <div className="demo-banner">
                <FlaskConical size={17} />
                <span>
                  <strong>Public demo</strong> · Synthetic invoices, no private writes.{' '}
                  <Link href="/proof">
                    {publishedMemoryCount} confirmed Mainnet memories are in the separate proof set
                    ↗
                  </Link>
                </span>
                <button onClick={() => setModal('login')}>
                  Owner login <ArrowRight size={14} />
                </button>
              </div>
            )}
            {loadError && (
              <div role="alert" className="error-banner">
                {loadError}
                <button className="button outline small" onClick={() => void refresh(true)}>
                  Retry
                </button>
              </div>
            )}
            {data?.mode === 'member' && (
              <p className="notice">
                Private wallet account · No administrator privileges ·{' '}
                <Link href="/connect">Switch wallet</Link>
              </p>
            )}
            {!data && !loadError && (
              <div className="skeleton-grid" aria-label="Loading workspace" aria-busy="true">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="skeleton" />
                ))}
              </div>
            )}
            {data && (
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                {view === 'overview' && <Overview data={data} onAdd={() => openInvoice()} />}
                {view === 'vendors' && (
                  <VendorProfiles data={data} notify={notify} onChanged={() => void refresh()} />
                )}
                {view === 'replay' && <AttackReplayLab />}
                {view === 'invoices' && (
                  <Inbox
                    data={data}
                    busy={busy}
                    onEdit={openInvoice}
                    onDelete={async (i) => {
                      if (!owner) {
                        setModal('login');
                        return;
                      }
                      if (
                        !confirm(
                          `Delete ${i.number}? Audit and Walrus memory records will be retained.`,
                        )
                      )
                        return;
                      setBusy(true);
                      try {
                        await api(`invoices/${i.id}`, {}, 'DELETE');
                        await refresh();
                        notify('Invoice deleted. Audit history retained.');
                      } catch (e) {
                        notify((e as Error).message, true);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                )}
                {view === 'review' && (
                  <>
                    {invoice && assessment ? (
                      <>
                        <div className="review-toolbar">
                          <Field label="Invoice to review">
                            <select
                              value={invoice.id}
                              onChange={(e) => setSelected(e.target.value)}
                            >
                              {data.invoices.map((i) => (
                                <option value={i.id} key={i.id}>
                                  {i.vendor} · {i.number}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <div className="segmented">
                            <button
                              disabled={busy}
                              aria-pressed={!memoryOn}
                              className={!memoryOn ? 'active' : ''}
                              onClick={() => void recheck(false)}
                            >
                              Memory OFF
                            </button>
                            <button
                              disabled={busy}
                              aria-pressed={memoryOn}
                              className={memoryOn ? 'active mint-active' : ''}
                              onClick={() => void recheck(true)}
                            >
                              <BrainCircuit size={15} /> Memory ON
                            </button>
                          </div>
                          <button
                            className="button outline"
                            onClick={() => void recheck()}
                            disabled={busy}
                          >
                            {busy ? (
                              <LoaderCircle className="spin" size={16} />
                            ) : (
                              <RefreshCw size={16} />
                            )}{' '}
                            Recheck invoice
                          </button>
                        </div>
                        <div className="review-grid">
                          <section className="panel invoice-detail">
                            <div className="panel-top">
                              <span className="vendor-avatar">{invoice.vendor[0]}</span>
                              {invoice.isDemo && <Badge>Sample data</Badge>}
                            </div>
                            <h2>{invoice.vendor}</h2>
                            <p>{invoice.number}</p>
                            <div className="invoice-value">{money(invoice)}</div>
                            <Badge tone={invoice.status === 'paid' ? 'mint' : 'neutral'}>
                              {invoice.status === 'approved' ? 'Manually approved' : invoice.status}
                            </Badge>
                            <dl className="detail-list">
                              <div>
                                <dt>Issued</dt>
                                <dd>{invoice.issued}</dd>
                              </div>
                              <div>
                                <dt>Due date</dt>
                                <dd>{invoice.due}</dd>
                              </div>
                              <div>
                                <dt>Source</dt>
                                <dd>{invoice.source.toUpperCase()}</dd>
                              </div>
                              <div>
                                <dt>Recipient</dt>
                                <dd>
                                  <code title={invoice.recipient}>
                                    {invoice.recipient ? short(invoice.recipient) : 'Not provided'}
                                  </code>
                                </dd>
                              </div>
                              <div>
                                <dt>Agreed tokens</dt>
                                <dd>{invoice.tokenAmount || 'Not provided'}</dd>
                              </div>
                            </dl>
                            <p className="muted small-text">{invoice.memo}</p>
                            <button
                              className="button outline full"
                              disabled={!owner || invoice.status !== 'open'}
                              onClick={() => openInvoice(invoice)}
                            >
                              <Pencil size={15} /> Edit invoice
                            </button>
                          </section>
                          <section className="panel agent-panel">
                            <div className="panel-top">
                              <div className="panel-title">
                                <span className="agent-icon">
                                  <Sparkles size={19} />
                                </span>
                                <div>
                                  <h2>Why PayGuard flagged this</h2>
                                  <span className="muted small-text">
                                    Deterministic evidence · Human decision
                                  </span>
                                </div>
                              </div>
                              <RiskBadge assessment={assessment} />
                            </div>
                            <div className="risk-meter">
                              <div>
                                <span>Review priority</span>
                                <strong>
                                  {assessment.score}
                                  <small> / 100</small>
                                </strong>
                              </div>
                              <div className="meter-track">
                                <span style={{ width: `${assessment.score}%` }} />
                              </div>
                              <small>
                                Rule weights, not a fraud probability. Baseline:{' '}
                                {assessment.baselineSize} confirmed invoices.
                              </small>
                            </div>
                            <FindingList assessment={assessment} />
                            <div className="recall-status">
                              <BrainCircuit size={17} />
                              <div>
                                <strong>Which memories influenced this</strong>
                                <p>{assessment.memoryStatus}</p>
                                {assessment.citations.map((c) => (
                                  <p key={c.id}>
                                    <Badge tone="cyan">Used for decision</Badge>{' '}
                                    <code>{short(c.blobId)}</code>
                                  </p>
                                ))}
                              </div>
                            </div>
                            <div className="review-actions">
                              <button
                                className="button primary"
                                onClick={() => (owner ? setModal('correction') : setModal('login'))}
                              >
                                <BrainCircuit size={17} /> Correct this assessment
                              </button>
                              <button
                                className="button outline"
                                disabled={!owner || invoice.status === 'paid'}
                                onClick={() => setModal('status')}
                              >
                                Record human decision
                              </button>
                            </div>
                          </section>
                        </div>
                        <div className="comparison-grid">
                          <section className="panel">
                            <span className="eyebrow">BEFORE MEMORY</span>
                            <h3>Generic checks + mandatory rules</h3>
                            {comparisons[invoice.id]?.off ? (
                              <>
                                <RiskBadge assessment={comparisons[invoice.id].off!} />
                                <p>
                                  {comparisons[invoice.id]
                                    .off!.findings.map((f) => f.title)
                                    .join(' · ')}
                                </p>
                              </>
                            ) : (
                              <p>Run Memory OFF to capture a fresh baseline for this invoice.</p>
                            )}
                          </section>
                          <section className="panel">
                            <span className="eyebrow mint-text">AFTER MEMORY</span>
                            <h3>Context from actual recall</h3>
                            {comparisons[invoice.id]?.on ? (
                              <>
                                <RiskBadge assessment={comparisons[invoice.id].on!} />
                                <p>{comparisons[invoice.id].on!.memoryStatus}</p>
                                <p>
                                  {comparisons[invoice.id]
                                    .on!.findings.filter((f) => f.memoryId)
                                    .map((f) => f.title)
                                    .join(' · ') || 'No additional recalled policy was applied.'}
                                </p>
                              </>
                            ) : (
                              <p>
                                Run Memory ON. A changed assessment requires a relevant, confirmed
                                memory returned by Walrus.
                              </p>
                            )}
                          </section>
                        </div>
                        <VerificationPanel
                          key={invoice.id}
                          invoice={invoice}
                          data={data}
                          notify={notify}
                          onChanged={() => {
                            setComparisons({});
                            void refresh();
                          }}
                        />
                        <TransactionPane invoice={invoice} owner={!!owner} busy={busy} act={act} />
                      </>
                    ) : (
                      <section className="panel">
                        <Empty title="Nothing to review yet">
                          <p>Add an invoice or load the synthetic scenarios in Settings.</p>
                          <button className="button primary" onClick={() => openInvoice()}>
                            Add invoice
                          </button>
                        </Empty>
                      </section>
                    )}
                  </>
                )}
                {view === 'wallets' && (
                  <WalletWatch data={data} busy={busy} act={act} notify={notify} />
                )}
                {view === 'memory' &&
                  (data.mode === 'public-demo' ? (
                    <PublicMemoryLab />
                  ) : (
                    <MemoryLab
                      data={data}
                      busy={busy}
                      setBusy={setBusy}
                      refresh={refresh}
                      notify={notify}
                      act={act}
                    />
                  ))}
                {view === 'activity' && <Audit data={data} />}
                {view === 'settings' && (
                  <Settings data={data} busy={busy} act={act} onLogin={() => setModal('login')} />
                )}
                {view === 'settings/integrations' && (
                  <Integrations
                    data={data}
                    busy={busy}
                    act={act}
                    onLogin={() => setModal('login')}
                  />
                )}
              </motion.div>
            )}
            <footer className="app-footer">
              <span>
                <ShieldCheck size={13} /> Assistive review. You stay in control.
              </span>
              <span>
                PayGuard AI <span className="muted">/</span> {owner ? data?.storage : 'Guided demo'}
              </span>
            </footer>
          </main>
        </div>
        {toast && (
          <div
            role={toast.error ? 'alert' : 'status'}
            className={`toast ${toast.error ? 'toast-error' : ''}`}
          >
            {toast.error ? <AlertTriangle size={19} /> : <Check size={19} />}
            <span>{toast.text}</span>
            <button aria-label="Dismiss notification" onClick={() => setToast(undefined)}>
              <X size={16} />
            </button>
          </div>
        )}
        {modal === 'login' && (
          <Modal title="Owner administrator sign in" onClose={() => setModal(null)}>
            <form
              className="form-stack"
              onSubmit={async (e: FormEvent<HTMLFormElement>) => {
                e.preventDefault();
                const password = new FormData(e.currentTarget).get('password');
                e.currentTarget.reset(); // Do not retain credentials in DOM snapshots after submission.
                setBusy(true);
                try {
                  await api('auth/login', { password });
                  snapshotGeneration.current++;
                  setData(undefined);
                  setComparisons({});
                  setModal(null);
                  const loaded = await refresh();
                  notify(
                    loaded
                      ? 'Owner workspace unlocked.'
                      : 'Signed in, but the private workspace could not load. Retry Refresh.',
                    !loaded,
                  );
                } catch (error) {
                  notify((error as Error).message, true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="login-icon">
                <LockKeyhole size={27} />
              </div>
              <p>
                The public demo uses synthetic invoices and needs no account. Owner mode protects
                private invoice reviews and live integrations. Wallet users can create a separate
                personal account using Connect Sui Wallet. This password form is for the
                administrator.
              </p>
              <Field label="Owner password">
                <input
                  required
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  maxLength={256}
                />
              </Field>
              <Submit busy={busy}>Sign in securely</Submit>
              <Link href="/connect" className="button outline full">
                Connect Sui Wallet for a personal account
              </Link>
              <p className="small-text muted">
                For setup, configure DATABASE_URL, AUTH_SECRET, OWNER_PASSWORD and APP_URL privately
                on the server. Never enter a wallet seed or private key here.
              </p>
            </form>
          </Modal>
        )}
        {modal === 'invoice' && (
          <Modal title={edit ? 'Edit invoice' : 'Add an invoice'} onClose={() => setModal(null)}>
            <InvoiceForm
              invoice={edit}
              busy={busy}
              setBusy={setBusy}
              notify={notify}
              onSaved={(id) => {
                setComparisons({});
                setSelected(id);
                setModal(null);
                void refresh();
              }}
            />
          </Modal>
        )}
        {modal === 'correction' && invoice && assessment && (
          <Modal title="Teach your payment guardian" onClose={() => setModal(null)}>
            <CorrectionForm
              invoice={invoice}
              assessment={assessment}
              configured={!!data?.integrations.memory}
              busy={busy}
              setBusy={setBusy}
              notify={notify}
              onSaved={() => {
                setModal(null);
                void refresh();
              }}
            />
          </Modal>
        )}
        {modal === 'status' && invoice && (
          <Modal title="Record your decision" onClose={() => setModal(null)}>
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const r = await act(
                  'invoices/status',
                  { invoiceId: invoice.id, status: form.get('status'), reason: form.get('reason') },
                  'Human decision recorded in the audit trail.',
                );
                if (r) setModal(null);
              }}
            >
              <p>
                Manual approval is a review decision, not proof of payment. Only verified chain
                evidence can set an invoice to paid.
              </p>
              <Field label="Decision">
                <select name="status">
                  <option value="approved">Approve review</option>
                  <option value="escalated">Escalate</option>
                  <option value="rejected">Reject</option>
                  <option value="open">Reopen for review</option>
                </select>
              </Field>
              <Field label="Reason">
                <textarea name="reason" required minLength={8} maxLength={1000} rows={3} />
              </Field>
              <Submit busy={busy}>Save decision</Submit>
            </form>
          </Modal>
        )}
      </div>
    </MotionConfig>
  );
}
type Act = <T = Record<string, unknown>>(
  path: string,
  payload?: unknown,
  message?: string,
) => Promise<T | undefined>;
function Overview({ data, onAdd }: { data: Snapshot; onAdd: () => void }) {
  const open = data.invoices.filter((i) => i.status === 'open');
  const review = open.filter((i) =>
    ['Needs review', 'High risk / verification required'].includes(data.assessments[i.id].level),
  );
  const duplicates = data.invoices.filter((i) =>
    data.assessments[i.id].findings.some(
      (f) => f.id === 'duplicate-number' || f.id === 'near-duplicate',
    ),
  );
  const confirmed = data.memories.filter((m) => m.status === 'confirmed');
  const metrics = [
    {
      label: data.mode === 'public-demo' ? 'Sample invoices' : 'Invoices in workspace',
      value: data.invoices.length,
      sub:
        data.mode === 'public-demo'
          ? 'Synthetic practice dataset'
          : `${open.length} awaiting a decision`,
      icon: FileText,
      tone: 'cyan',
    },
    {
      label: 'Needs your review',
      value: review.length,
      sub: 'Your attention makes the difference',
      icon: ShieldCheck,
      tone: 'amber',
    },
    {
      label: 'Duplicate signals',
      value: duplicates.length,
      sub: 'Exact and possible matches',
      icon: Fingerprint,
      tone: 'danger',
    },
    {
      label: data.mode === 'public-demo' ? 'Supplier payments' : 'Confirmed Sui payments',
      value: data.mode === 'public-demo' ? '—' : data.confirmedPayments,
      sub:
        data.mode === 'public-demo'
          ? 'No transfers in public practice'
          : 'Matched to live chain evidence',
      icon: Wallet,
      tone: 'mint',
    },
  ];
  return (
    <>
      <div className="metrics-grid">
        {metrics.map((m) => (
          <section className="metric-card" key={m.label}>
            <div>
              <span>{m.label}</span>
              <span className={`metric-icon ${m.tone}`}>
                <m.icon size={18} />
              </span>
            </div>
            <strong>
              {typeof m.value === 'number' ? m.value.toString().padStart(2, '0') : m.value}
            </strong>
            <small>{m.sub}</small>
          </section>
        ))}
      </div>
      <div className="overview-grid">
        <section className="panel attention-panel">
          <div className="panel-top">
            <h2>
              On your radar <span className="count-pill">{review.length}</span>
            </h2>
            <Link className="inline-link" href="/app/review">
              Review center <ArrowUpRight size={15} />
            </Link>
          </div>
          {data.preferences.alerts && review.length ? (
            review.slice(0, 3).map((i) => (
              <Link className="alert-row" key={i.id} href={`/app/review?invoice=${i.id}`}>
                <span
                  className={`vendor-avatar ${data.assessments[i.id].level.startsWith('High') ? 'rose' : 'gold'}`}
                >
                  {i.vendor[0]}
                </span>
                <div>
                  <strong>{i.vendor}</strong>
                  <p>{data.assessments[i.id].findings.find((f) => f.severity !== 'info')?.title}</p>
                </div>
                <div>
                  <strong>{money(i)}</strong>
                  <small>{i.number}</small>
                </div>
                <ChevronRight size={17} />
              </Link>
            ))
          ) : (
            <Empty title="Your review queue is clear">
              <p>Add an invoice to get started.</p>
            </Empty>
          )}
          <div className="panel-foot">
            <span className="status-dot amber-dot" /> Findings are review signals, never a fraud
            verdict.
          </div>
        </section>
        <section className="panel memory-pulse">
          <div className="panel-top">
            <h2>
              <BrainCircuit size={19} /> Memory pulse
            </h2>
            <Badge tone="cyan">Walrus</Badge>
          </div>
          <div className="memory-count">
            <strong>
              {(data.mode === 'public-demo' ? publishedMemoryCount : confirmed.length)
                .toString()
                .padStart(2, '0')}
            </strong>
            <div>
              {data.mode === 'public-demo'
                ? 'Published Mainnet proof'
                : 'Your confirmed Mainnet memories'}
              {data.mode === 'public-demo' ? (
                <small>Recorded evidence · separate from sample data</small>
              ) : (
                <small>
                  {data.memories.filter((m) => m.status === 'pending').length} pending ·{' '}
                  {data.memories.filter((m) => m.status === 'failed').length} failed
                </small>
              )}
            </div>
          </div>
          <div className="memory-flow">
            <FileText size={21} />
            <span />
            <ShieldCheck size={21} />
            <span />
            <BrainCircuit size={25} />
            <span />
            <Sparkles size={21} />
          </div>
          <p>
            {data.mode === 'public-demo'
              ? 'The project’s confirmed receipts are available in the read-only evidence view. Public practice creates no memories.'
              : confirmed.length
                ? 'Your verified corrections are ready for semantic recall.'
                : 'Every guardian starts somewhere. Save a correction to begin the learning loop.'}
          </p>
          <Link
            className="button outline full"
            href={data.mode === 'public-demo' ? '/proof#memory' : '/app/memory'}
          >
            {data.mode === 'public-demo' ? 'Inspect published memory proof' : 'Open Memory Lab'}{' '}
            <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <div className="overview-grid lower-grid">
        <section className="panel">
          <div className="panel-top">
            <h2>Review signals by invoice</h2>
            <Badge>{data.mode === 'public-demo' ? 'Sample data' : 'Stored data'}</Badge>
          </div>
          <div
            className="trend-chart"
            role="img"
            aria-label="Rule-based review scores for the latest eight invoices"
          >
            {data.invoices
              .slice(0, 8)
              .reverse()
              .map((i) => (
                <div className="chart-column" key={i.id}>
                  <span>{data.assessments[i.id].score}</span>
                  <div
                    className={`chart-bar ${data.assessments[i.id].score >= 40 ? 'high' : ''}`}
                    style={{ height: `${Math.max(3, data.assessments[i.id].score)}%` }}
                  />
                  <small title={i.number}>{i.number.slice(-4)}</small>
                </div>
              ))}
          </div>
          <div className="chart-legend">
            <span />
            <span>Rule priority · 0–100, not fraud probability</span>
          </div>
        </section>
        <section className="panel demo-card">
          <div className="panel-top">
            <span className="demo-icon">
              <FlaskConical size={24} />
            </span>
            <Badge tone="mint">Demo Lab</Badge>
          </div>
          <h2>Stop the payout switch.</h2>
          <p>
            Review a payout switch. Save a correction. Open the next invoice in a new session and
            see what Walrus recalls.
          </p>
          <Link className="button primary" href="/app/replay">
            Open Attack Replay Lab <ArrowUpRight size={16} />
          </Link>
        </section>
      </div>
      <section className="panel">
        <div className="panel-top">
          <h2>Recent invoices</h2>
          <Link className="inline-link" href="/app/invoices">
            View all <ArrowUpRight size={15} />
          </Link>
        </div>
        <InvoiceTable data={data} invoices={data.invoices.slice(0, 5)} />
        {!data.invoices.length && (
          <Empty title="Your inbox starts here">
            <button className="button primary" onClick={onAdd}>
              Add your first invoice
            </button>
          </Empty>
        )}
      </section>
      <div className="connection-row">
        {[
          { name: 'Neon database', ok: data.integrations.database },
          { name: 'Walrus Memory', ok: data.integrations.memory },
          { name: 'Tatum Sui gRPC', ok: data.integrations.tatum },
        ].map((i) => (
          <Link key={i.name} href="/app/settings/integrations">
            <span className={`tiny-dot ${i.ok ? '' : 'off'}`} />
            <strong>{i.name}</strong>
            <span>{i.ok ? 'Configured · test connection' : 'Not configured in this view'}</span>
            <ArrowUpRight size={14} />
          </Link>
        ))}
      </div>
    </>
  );
}
function InvoiceTable({
  data,
  invoices,
  actions,
}: {
  data: Snapshot;
  invoices: Invoice[];
  actions?: (i: Invoice) => ReactNode;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Vendor / invoice</th>
            <th>Amount</th>
            <th>Due date</th>
            <th>Review signal</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((i) => (
            <tr key={i.id}>
              <td>
                <Link className="vendor-cell" href={`/app/review?invoice=${i.id}`}>
                  <span className="vendor-avatar small-avatar">{i.vendor[0]}</span>
                  <span>
                    <strong>{i.vendor}</strong>
                    <small>
                      {i.number} {i.isDemo && <span className="sample-text">· Sample</span>}
                    </small>
                  </span>
                </Link>
              </td>
              <td className="numeric">{money(i)}</td>
              <td className="muted">{i.due}</td>
              <td>
                <RiskBadge assessment={data.assessments[i.id]} />
              </td>
              <td>
                <span className={`status-text ${i.status === 'paid' ? 'mint-text' : ''}`}>
                  {i.status === 'approved' ? 'Approved review' : i.status}
                </span>
              </td>
              <td>
                {actions ? (
                  actions(i)
                ) : (
                  <Link
                    className="icon-button"
                    href={`/app/review?invoice=${i.id}`}
                    aria-label={`Review ${i.number}`}
                  >
                    <ArrowUpRight size={17} />
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Inbox({
  data,
  onEdit,
  onDelete,
  busy,
}: {
  data: Snapshot;
  onEdit: (i: Invoice) => void;
  onDelete: (i: Invoice) => void;
  busy: boolean;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const list = data.invoices.filter(
    (i) =>
      (filter === 'all' || i.status === filter) &&
      `${i.vendor} ${i.number}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="panel">
      <div className="inbox-toolbar">
        <label className="search-input">
          <Search size={17} />
          <input
            aria-label="Search invoices"
            placeholder="Search vendor or invoice…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter invoice status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {['all', 'open', 'approved', 'escalated', 'rejected', 'paid'].map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All statuses' : s}
            </option>
          ))}
        </select>
        <Badge>{list.length} invoices</Badge>
      </div>
      {list.length ? (
        <InvoiceTable
          data={data}
          invoices={list}
          actions={(i) => (
            <div className="row-actions">
              <button
                disabled={busy || i.status !== 'open'}
                className="icon-button"
                aria-label={`Edit ${i.number}`}
                onClick={() => onEdit(i)}
              >
                <Pencil size={15} />
              </button>
              <button
                disabled={busy || i.status === 'paid'}
                className="icon-button"
                aria-label={`Delete ${i.number}`}
                onClick={() => onDelete(i)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}
        />
      ) : (
        <Empty title="No invoices match">
          <p>Try another filter or add an invoice.</p>
        </Empty>
      )}
    </section>
  );
}
function TransactionPane({
  invoice,
  owner,
  busy,
  act,
}: {
  invoice?: Invoice;
  owner: boolean;
  busy: boolean;
  act: Act;
}) {
  const [digest, setDigest] = useState('');
  const [evidence, setEvidence] = useState<Verification>();
  const [inspection, setInspection] = useState<{
    transaction: ChainTransaction;
    chainId: string;
    explorer: string;
  }>();
  async function submit(e: FormEvent) {
    e.preventDefault();
    setEvidence(undefined);
    setInspection(undefined);
    if (invoice) {
      const r = await act<Verification>('payments/verify', { invoiceId: invoice.id, digest });
      if (r) setEvidence(r);
    } else {
      const r = await act<{ transaction: ChainTransaction; chainId: string; explorer: string }>(
        'transactions/inspect',
        { digest },
      );
      if (r) setInspection(r);
    }
  }
  const tx = evidence?.transaction || inspection?.transaction;
  return (
    <section className="panel transaction-panel">
      <div className="panel-top">
        <div className="panel-title">
          <Fingerprint size={22} />
          <div>
            <h2>Transaction Inspector</h2>
            <span className="small-text muted">
              {invoice ? 'What PayGuard checked onchain' : 'Inspect a real Sui Mainnet transaction'}
            </span>
          </div>
        </div>
        <Badge tone="cyan">Tatum · Mainnet</Badge>
      </div>
      <p>
        Paste a mainnet digest to verify. Recipient, coin, exact agreed token amount, execution and
        uniqueness are checked independently.
      </p>
      {invoice && owner && (
        <p>
          <Link className="inline-link" href="/services">
            Request supplemental analysis · Mainnet service proposal
          </Link>
        </p>
      )}
      <form className="inline-form" onSubmit={submit}>
        <Field label="Transaction digest">
          <input
            value={digest}
            onChange={(e) => setDigest(e.target.value)}
            required
            placeholder="Base58 Sui Mainnet transaction digest"
            minLength={43}
            maxLength={44}
          />
        </Field>
        <Submit busy={busy} disabled={!owner}>
          {invoice ? 'Verify payment' : 'Inspect transaction'}
        </Submit>
      </form>
      {!owner && (
        <p className="small-text muted">
          <LockKeyhole size={13} /> Owner login is required for live Tatum requests.
        </p>
      )}
      {evidence && (
        <>
          <div className="result-heading">
            <Badge
              tone={
                evidence.status === 'Confirmed match'
                  ? 'mint'
                  : evidence.status === 'Mismatch'
                    ? 'danger'
                    : 'amber'
              }
            >
              {evidence.status}
            </Badge>
            <span>
              {evidence.network} · {evidence.chainId}
            </span>
          </div>
          <div className="criteria-list">
            {evidence.criteria.map((c) => (
              <div key={c.label}>
                <span>
                  {c.passed === true ? (
                    <Check className="mint-text" size={16} />
                  ) : c.passed === false ? (
                    <X className="danger-text" size={16} />
                  ) : (
                    <CircleHelp size={16} />
                  )}
                </span>
                <strong>{c.label}</strong>
                <p>{c.detail}</p>
              </div>
            ))}
          </div>
        </>
      )}
      {tx && (
        <div className="transaction-data">
          <div className="panel-top">
            <h3>Chain evidence</h3>
            <a
              className="inline-link"
              href={evidence?.explorer || inspection?.explorer}
              target="_blank"
              rel="noreferrer"
            >
              View on SuiScan <ExternalLink size={14} />
            </a>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Digest</dt>
              <dd>
                <code>{tx.digest}</code>
              </dd>
            </div>
            <div>
              <dt>Sender</dt>
              <dd>
                <code>{tx.transaction?.data.sender || 'Unavailable'}</code>
              </dd>
            </div>
            <div>
              <dt>Checkpoint</dt>
              <dd>{tx.checkpoint || 'Unavailable'}</dd>
            </div>
            <div>
              <dt>Timestamp</dt>
              <dd>
                {tx.timestampMs ? new Date(Number(tx.timestampMs)).toISOString() : 'Unavailable'}
              </dd>
            </div>
          </dl>
          <h4>Balance changes · atomic units</h4>
          {tx.balanceChanges?.map((c, i) => (
            <div className="balance-change" key={i}>
              <code>
                {typeof c.owner === 'object'
                  ? 'AddressOwner' in c.owner
                    ? c.owner.AddressOwner
                    : JSON.stringify(c.owner)
                  : c.owner}
              </code>
              <span>{c.coinType}</span>
              <strong>{c.amount}</strong>
            </div>
          )) || <p>No balance changes returned.</p>}
        </div>
      )}
    </section>
  );
}
function WalletWatch({
  data,
  busy,
  act,
  notify,
}: {
  data: Snapshot;
  busy: boolean;
  act: Act;
  notify: (s: string, error?: boolean) => void;
}) {
  const [result, setResult] = useState<{
    activityStatus?: string;
    walletId: string;
    direction: 'incoming' | 'outgoing';
    transactions: { data: ChainTransaction[]; nextCursor: string | null; hasNextPage: boolean };
  }>();
  const [direction, setDirection] = useState<'incoming' | 'outgoing'>('incoming');
  async function refresh(id: string, cursor: string | null = null) {
    const r = await act<{
      activityStatus: string;
      transactions: { data: ChainTransaction[]; nextCursor: string | null; hasNextPage: boolean };
    }>('wallets/refresh', { id, cursor, direction });
    if (r)
      setResult({
        walletId: id,
        direction,
        transactions: r.transactions,
        activityStatus: r.activityStatus,
      });
  }
  return (
    <>
      <div className="notice">
        <LockKeyhole size={18} />
        <span>
          Watch-only. PayGuard never requests a spending key, signs a transaction or transfers
          funds.
        </span>
      </div>
      <section className="panel">
        <div className="panel-top">
          <h2>Your watchlist</h2>
          <Badge tone="cyan">Sui Mainnet</Badge>
        </div>
        <form
          className="wallet-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            const r = await act(
              'wallets',
              { label: f.get('label'), address: f.get('address') },
              'Watch-only address added.',
            );
            if (r) form.reset();
          }}
        >
          <Field label="Wallet label">
            <input name="label" required maxLength={80} placeholder="Operating wallet" />
          </Field>
          <Field label="Full Sui address">
            <input name="address" required pattern="0x[a-fA-F0-9]{64}" placeholder="0x…" />
          </Field>
          <Submit busy={busy} disabled={data.mode === 'public-demo'}>
            Add watch-only wallet
          </Submit>
        </form>
        {data.wallets.map((w) => (
          <div className="wallet-row" key={w.id}>
            <span className="wallet-symbol">
              <Wallet size={23} />
            </span>
            <div>
              <strong>{w.label}</strong>
              <code>{short(w.address, 12)}</code>
              <small>
                Last refreshed: {w.refreshedAt ? new Date(w.refreshedAt).toLocaleString() : 'Never'}
              </small>
            </div>
            <div className="wallet-balance">
              <strong>
                {w.balance === null
                  ? 'Unverified'
                  : `${(BigInt(w.balance) / 1000000000n).toString()}.${(BigInt(w.balance) % 1000000000n).toString().padStart(9, '0').replace(/0+$/, '') || '0'} SUI`}
              </strong>
              <span>Cached from last successful refresh</span>
            </div>
            <button
              className="button outline small"
              disabled={busy}
              onClick={() => void refresh(w.id)}
            >
              <RefreshCw size={15} />
              Refresh
            </button>
            <button
              className="icon-button"
              disabled={busy}
              aria-label={`Remove ${w.label}`}
              onClick={() =>
                void act('wallets/remove', { id: w.id }, 'Address removed from watchlist.')
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {!data.wallets.length && (
          <Empty icon={Wallet} title="A quiet watchlist">
            <p>
              Add an address to query real balances and activity through Tatum. Valid syntax is not
              evidence of trust.
            </p>
          </Empty>
        )}
        <div className="inline-form">
          <Field label="Transaction direction">
            <select
              value={direction}
              onChange={(e) => {
                setDirection(e.target.value as 'incoming' | 'outgoing');
                setResult(undefined);
              }}
            >
              <option value="incoming">Incoming credits (affected address)</option>
              <option value="outgoing">Outgoing (sender)</option>
            </select>
          </Field>
          <p className="small-text muted">
            Choose direction, then refresh a wallet. Provider filters are candidate discovery, not
            payment confirmation.
          </p>
        </div>
        {result && (
          <div className="transaction-list">
            {result.activityStatus !== 'Available' && (
              <div className="notice">{result.activityStatus}</div>
            )}
            <h3>{result.direction === 'incoming' ? 'Incoming' : 'Outgoing'} candidates</h3>
            {result.transactions.data.length ? (
              result.transactions.data.map((tx) => (
                <div key={tx.digest}>
                  <ArrowDownLeft size={16} />
                  <code>{short(tx.digest, 14)}</code>
                  <Badge>Candidate</Badge>
                  <button
                    className="button text-button small"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(tx.digest)
                        .then(() => notify('Digest copied. Paste it into the inspector below.'))
                        .catch(() =>
                          notify('Clipboard unavailable. Select and copy the digest.', true),
                        );
                    }}
                  >
                    Copy digest
                  </button>
                </div>
              ))
            ) : (
              <p>No transactions returned for this page.</p>
            )}
            {result.transactions.hasNextPage && (
              <button
                className="button outline"
                disabled={busy}
                onClick={() => void refresh(result.walletId, result.transactions.nextCursor)}
              >
                Next page <ArrowRight size={15} />
              </button>
            )}
          </div>
        )}
      </section>
      <TransactionPane owner={data.mode !== 'public-demo'} busy={busy} act={act} />
    </>
  );
}
function MemoryLab({
  data,
  busy,
  setBusy,
  refresh,
  notify,
  act,
}: {
  data: Snapshot;
  busy: boolean;
  setBusy: (b: boolean) => void;
  refresh: () => Promise<boolean>;
  notify: (s: string, error?: boolean) => void;
  act: Act;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [recalled, setRecalled] = useState<{ citations: Citation[]; status: string }>();
  const [progress, setProgress] = useState('');
  const count = (status: string) => data.memories.filter((m) => m.status === status).length;
  async function seed() {
    setBusy(true);
    try {
      const jobs = await api<MemoryJobView[]>('memory/seed', {});
      for (let i = 0; i < jobs.length; i++) {
        if (jobs[i].status === 'confirmed' || jobs[i].status === 'failed') continue;
        setProgress(`Checking event ${i + 1} of ${jobs.length}. Only completed writes count.`);
        await api('memory/resume', { id: jobs[i].id });
        await refresh();
      }
      notify('Seed pass completed. Review confirmed, pending and failed counts below.');
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setProgress('');
      setBusy(false);
      await refresh();
    }
  }
  const payout = data.invoices.find(
    (i) => i.isDemo && i.vendor === 'Northstar Studio' && i.status === 'open',
  );
  const duplicate = data.invoices.find((i) => i.isDemo && i.vendor === 'Orbit Hosting');
  return (
    <>
      <div className="memory-hero panel">
        <div>
          <span className="eyebrow">PERSISTENT CONTEXT. VISIBLE PROVENANCE.</span>
          <h2>Your guardian’s memory.</h2>
          <p>
            Real Mainnet writes, real recall. A pending job stays pending until Walrus confirms its
            blob and indexing.
          </p>
        </div>
        <div className="memory-stats">
          {[
            { s: 'confirmed', label: 'Confirmed', tone: 'mint-text' },
            { s: 'pending', label: 'Pending', tone: 'amber-text' },
            { s: 'failed', label: 'Failed', tone: 'danger-text' },
          ].map((c) => (
            <div key={c.s}>
              <strong className={c.tone}>{count(c.s).toString().padStart(2, '0')}</strong>
              <span>{c.label}</span>
            </div>
          ))}
        </div>
      </div>
      <section className="panel">
        <div className="panel-top">
          <h2>
            <FlaskConical size={20} /> Demo Lab
          </h2>
          <Badge>Guided scenarios · Sample data</Badge>
        </div>
        <div className="scenario-grid">
          {[
            {
              n: '01',
              title: 'The payout switch',
              body: 'Compare the baseline, remember a vendor address rule, then review a later invoice in a new session.',
              invoice: payout,
              action: 'Review payout change',
            },
            {
              n: '02',
              title: 'The repeated bill',
              body: 'Inspect a duplicate, save a correction and recall its pattern during the next review.',
              invoice: duplicate,
              action: 'Review duplicate billing',
            },
            {
              n: '03',
              title: 'The onchain check',
              body: 'Paste a real mainnet digest. Inspect recipient, coin, amount and execution through Tatum.',
              invoice: payout,
              action: 'Open payment inspector',
            },
          ].map((scenario) => (
            <article className="scenario" key={scenario.n}>
              <span className="scenario-number">{scenario.n}</span>
              <h3>{scenario.title}</h3>
              <p>{scenario.body}</p>
              <Link
                className="inline-link"
                href={
                  scenario.invoice ? `/app/review?invoice=${scenario.invoice.id}` : '/app/review'
                }
              >
                {scenario.action}
                <ArrowUpRight size={15} />
              </Link>
            </article>
          ))}
        </div>
        <div className="demo-next">
          <div>
            <strong>Continue across sessions</strong>
            <p>
              Save a correction, create the next sample invoice, sign out, then sign back in from a
              new browser session. Recheck with Memory ON and OFF.
            </p>
          </div>
          <button
            className="button outline"
            disabled={busy || data.mode !== 'owner' || !payout}
            onClick={async () => {
              const r = await act<{ id: string }>(
                'demo/next',
                { invoiceId: payout?.id },
                'Later sample invoice created. Open it in a new signed-in browser session.',
              );
              if (r) router.push(`/app/review?invoice=${r.id}`);
            }}
          >
            Create next sample invoice <ArrowRight size={16} />
          </button>
        </div>
      </section>
      <div className="memory-two-column">
        <section className="panel">
          <div className="panel-top">
            <h2>
              <Search size={19} /> Semantic recall
            </h2>
            <Badge tone="cyan">Walrus Mainnet</Badge>
          </div>
          <p>
            Search approved abstract policies. Only confirmed, tenant-owned memories can influence a
            review.
          </p>
          <form
            className="inline-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await act<{ citations: Citation[]; status: string }>('memory/recall', {
                query,
              });
              if (r) setRecalled(r);
            }}
          >
            <input
              aria-label="Semantic memory query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              required
              minLength={3}
              maxLength={500}
              placeholder="e.g. recipient changes or repeated billing"
            />
            <Submit busy={busy} disabled={!data.integrations.memory}>
              Recall
            </Submit>
          </form>
          {recalled ? (
            <div className="recall-results">
              <p>{recalled.status}</p>
              {recalled.citations.map((c) => (
                <article key={c.id}>
                  <Badge tone="cyan">Retrieved from Walrus</Badge>
                  <p>{c.text.split('\n')[0]}</p>
                  <code>{c.blobId}</code>
                </article>
              ))}
            </div>
          ) : (
            <div className="subtle-empty">
              <BrainCircuit size={25} />
              <span>
                {data.integrations.memory
                  ? 'Search to retrieve memories from the live relayer.'
                  : 'Integration not configured. No local records will be presented as live recall.'}
              </span>
            </div>
          )}
        </section>
        {data.mode === 'member' ? (
          <section className="panel proof-panel">
            <h2>Your private learning record</h2>
            <p>
              You have {count('confirmed')} confirmed memories in this account. No memories from
              other accounts are shared here.
            </p>
            <p>
              The hackathon’s separate proof set contains {publishedMemoryCount} confirmed records.
              Your new account starts empty.
            </p>
            <Link href="/proof" className="inline-link">
              Read published Mainnet evidence ↗
            </Link>
            <Link href="/app/review" className="button outline full">
              Save a correction after a review
            </Link>
          </section>
        ) : (
          <section className="panel proof-panel">
            <div className="panel-top">
              <h2>
                <Fingerprint size={20} /> Mainnet proof
              </h2>
              <Badge tone={count('confirmed') >= 10 ? 'mint' : 'amber'}>
                {count('confirmed')} / 10 required
              </Badge>
            </div>
            <p>Only SDK-completed Mainnet writes with blob IDs count toward the submission.</p>
            <div className="proof-progress">
              <span style={{ width: `${Math.min(100, count('confirmed') * 10)}%` }} />
            </div>
            <dl className="detail-list">
              <div>
                <dt>Account ID</dt>
                <dd>
                  <code>{data.accountId ? short(data.accountId) : 'Not configured'}</code>
                </dd>
              </div>
              <div>
                <dt>Network</dt>
                <dd>Walrus Mainnet</dd>
              </div>
              <div>
                <dt>Proof status</dt>
                <dd>
                  {count('confirmed') >= 10
                    ? 'Memory count reached; verify recall too'
                    : 'Incomplete'}
                </dd>
              </div>
            </dl>
            <button
              className="button primary full"
              onClick={() => void seed()}
              disabled={busy || !data.integrations.memory}
            >
              {busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Seed /
              resume 12 demo memories
            </button>
            {progress && (
              <p role="status" className="small-text">
                {progress}
              </p>
            )}
            <small>
              Twelve distinct synthetic business events. One request at a time. Repeated runs reuse
              durable operation keys.
            </small>
          </section>
        )}
      </div>
      <section className="panel">
        <div className="panel-top">
          <h2>Memory timeline</h2>
          <Badge>{data.memories.length} recorded jobs</Badge>
        </div>
        {data.memories.length ? (
          <div className="memory-timeline">
            {data.memories.map((m) => (
              <article className="memory-entry" key={m.id}>
                <span className={`timeline-dot ${m.status}`} />
                <div>
                  <div className="memory-entry-heading">
                    <strong>{m.intent}</strong>
                    <Badge
                      tone={
                        m.status === 'confirmed'
                          ? 'mint'
                          : m.status === 'failed'
                            ? 'danger'
                            : 'amber'
                      }
                    >
                      {m.status}
                    </Badge>
                    {m.isDemo && <Badge>Sample event · Real write required</Badge>}
                    {data.usedMemoryIds.includes(m.id) && (
                      <Badge tone="cyan">Used for decision</Badge>
                    )}
                  </div>
                  <p>{m.text.split('\n')[0]}</p>
                  <dl className="memory-ids">
                    <div>
                      <dt>Job</dt>
                      <dd>
                        <code>{m.jobId || 'Not yet accepted'}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>Blob</dt>
                      <dd>
                        <code>{m.blobId || 'Not confirmed'}</code>
                      </dd>
                    </div>
                  </dl>
                  {m.error && <p className="amber-text">{m.error}</p>}
                  <div className="memory-entry-footer">
                    <time>{new Date(m.createdAt).toLocaleString()}</time>
                    {m.invoiceId && (
                      <Link className="inline-link" href={`/app/review?invoice=${m.invoiceId}`}>
                        Related review <ArrowUpRight size={13} />
                      </Link>
                    )}
                    {m.status === 'pending' && (
                      <button
                        disabled={busy || !data.integrations.memory}
                        className="button outline small"
                        onClick={() =>
                          void act('memory/resume', { id: m.id }, 'Memory status checked.')
                        }
                      >
                        Resume status check
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty icon={BrainCircuit} title="A fresh memory">
            <p>
              No confirmed Mainnet memory is claimed yet. Sign in, configure Walrus, then save a
              correction or seed the guided scenarios.
            </p>
          </Empty>
        )}
      </section>
      <div className="notice">
        <CircleHelp size={18} />
        <span>
          Retention is measured in Walrus storage epochs and may require renewal. Deleting an
          invoice or resetting samples does not erase its Walrus blobs, rules or audit history.
          Never put secrets or raw invoices into a memory.
        </span>
      </div>
    </>
  );
}
function Audit({ data }: { data: Snapshot }) {
  const [filter, setFilter] = useState('');
  const events = data.audit.filter((e) => !filter || e.type.startsWith(filter));
  return (
    <section className="panel">
      <div className="panel-top">
        <h2>Activity timeline</h2>
        <select
          aria-label="Filter audit events"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All events</option>
          {[
            'invoice',
            'review',
            'memory',
            'payment',
            'wallet',
            'integration',
            'demo',
            'settings',
          ].map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <p className="muted small-text">
        Append-only application log. The UI cannot edit or delete these records.
      </p>
      {events.length ? (
        <div className="audit-timeline">
          {events.map((e) => (
            <article key={e.id}>
              <span className="audit-symbol">
                <Activity size={16} />
              </span>
              <div>
                <strong>{e.type.replaceAll('.', ' / ').replaceAll('_', ' ')}</strong>
                <time>{new Date(e.createdAt).toLocaleString()}</time>
                <details>
                  <summary>Inspect recorded evidence</summary>
                  <pre>{JSON.stringify(e.detail, null, 2)}</pre>
                  <small>
                    Event {e.id}
                    {e.entityId && ` · Entity ${e.entityId}`}
                  </small>
                </details>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty icon={Activity} title="No recorded events in this view">
          <p>
            {data.mode === 'public-demo'
              ? 'Public visitors cannot access the owner’s private audit log.'
              : 'Imports, reviews, corrections, memory writes and verification will appear here.'}
          </p>
        </Empty>
      )}
    </section>
  );
}
function Settings({
  data,
  busy,
  act,
  onLogin,
}: {
  data: Snapshot;
  busy: boolean;
  act: Act;
  onLogin: () => void;
}) {
  const owner = data.mode !== 'public-demo';
  return (
    <div className="settings-grid">
      <section className="panel">
        <h2>Review preferences</h2>
        <p>Thresholds guide review; they never authorize a payment.</p>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            await act(
              'settings',
              {
                currency: form.get('currency'),
                threshold: form.get('threshold'),
                allowedTokens: String(form.get('tokens'))
                  .split('\n')
                  .map((t) => t.trim())
                  .filter(Boolean),
                alerts: form.get('alerts') === 'on',
              },
              'Review preferences saved.',
            );
          }}
        >
          <div className="form-grid">
            <Field label="Review currency">
              <input
                name="currency"
                defaultValue={data.preferences.currency}
                required
                maxLength={8}
              />
            </Field>
            <Field label="Manual review threshold">
              <input
                name="threshold"
                defaultValue={data.preferences.threshold}
                required
                inputMode="decimal"
              />
            </Field>
          </div>
          <Field
            label="Allowed coin types"
            hint="One full coin type per line. A token allowlist does not establish vendor trust."
          >
            <textarea
              name="tokens"
              defaultValue={data.preferences.allowedTokens.join('\n')}
              rows={3}
            />
          </Field>
          <label className="checkbox">
            <input name="alerts" type="checkbox" defaultChecked={data.preferences.alerts} />
            Show review alerts on the overview
          </label>
          <Submit busy={busy} disabled={!owner}>
            Save preferences
          </Submit>
        </form>
      </section>
      <div>
        <section className="panel">
          <h2>Workspace access</h2>
          <Link className="button outline full" href="/connect">
            Connect Sui Wallet / switch account
          </Link>
          <p>
            {owner
              ? 'Authenticated private session. Sessions expire after eight hours.'
              : 'You are exploring the public sample workspace.'}
          </p>
          <Badge tone={owner ? 'mint' : 'neutral'}>
            {data.mode === 'member'
              ? 'Wallet authenticated'
              : owner
                ? 'Owner authenticated'
                : 'Read-only public demo'}
          </Badge>
          {!owner && (
            <button className="button primary full" onClick={onLogin}>
              <LogIn size={16} />
              Owner login
            </button>
          )}
          <Link href="/app/settings/integrations" className="button outline full">
            <Zap size={16} /> Integration diagnostics <ArrowUpRight size={16} />
          </Link>
        </section>
        <section className="panel">
          <h2>Synthetic demo data</h2>
          <p>
            Load eight sample invoices. Reset removes unpaid sample invoices while preserving rules,
            memories, verified matches and audit records.
          </p>
          <div className="stack-actions">
            <button
              className="button outline"
              disabled={data.mode !== 'owner' || busy}
              onClick={() => void act('demo/seed', {}, 'Sample invoices loaded idempotently.')}
            >
              <FlaskConical size={16} />
              Load sample invoices
            </button>
            <button
              className="button danger-button"
              disabled={data.mode !== 'owner' || busy}
              onClick={() => {
                if (
                  confirm(
                    'Reset unpaid sample invoices? Audit, rules and Walrus memories will be retained.',
                  )
                )
                  void act('demo/reset', {}, 'Sample invoices reset. Historical proof remains.');
              }}
            >
              <Trash2 size={16} />
              Reset sample invoices
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
function Integrations({
  data,
  busy,
  act,
  onLogin,
}: {
  data: Snapshot;
  busy: boolean;
  act: Act;
  onLogin: () => void;
}) {
  const [health, setHealth] = useState<Record<string, unknown>>();
  if (data.mode !== 'owner')
    return (
      <section className="panel">
        <Empty icon={LockKeyhole} title="Owner-only diagnostics">
          <p>
            Connection health, account identifiers and integration evidence are restricted to the
            authenticated owner.
          </p>
          <button className="button primary" onClick={onLogin}>
            Owner login
          </button>
        </Empty>
      </section>
    );
  return (
    <>
      <div className="settings-grid">
        {[
          {
            title: 'Neon PostgreSQL',
            description: data.storage,
            env: 'DATABASE_URL',
            ok: data.integrations.database,
          },
          {
            title: 'Walrus Memory Mainnet',
            description: 'Managed Mainnet relayer · server-side delegate authentication',
            env: 'MEMWAL_PRIVATE_KEY · MEMWAL_ACCOUNT_ID · MEMWAL_SERVER_URL',
            ok: data.integrations.memory,
          },
          {
            title: 'Tatum Sui Mainnet RPC',
            description: 'https://sui-mainnet-grpc.gateway.tatum.io',
            env: 'TATUM_API_KEY',
            ok: data.integrations.tatum,
          },
        ].map((i) => (
          <section key={i.title} className="panel integration-card">
            <div className="panel-top">
              <h2>{i.title}</h2>
              <Badge tone={i.ok ? 'mint' : 'amber'}>{i.ok ? 'Configured' : 'Not configured'}</Badge>
            </div>
            <p>{i.description}</p>
            <code>{i.env}</code>
            <small>Configuration presence is not a successful connection test.</small>
          </section>
        ))}
        <section className="panel">
          <h2>Proof readiness</h2>
          <div className="memory-count">
            <strong>{data.memories.filter((m) => m.status === 'confirmed').length}</strong>
            <span>/ 10 Mainnet memories</span>
          </div>
          <p>
            {data.confirmedPayments} confirmed invoice payment matches. Run a live test and capture
            its evidence before submission.
          </p>
          <Link className="inline-link" href="/app/memory">
            Review memory proof <ArrowUpRight size={16} />
          </Link>
        </section>
      </div>
      <section className="panel">
        <div className="panel-top">
          <h2>Live connection test</h2>
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              const r = await act<Record<string, unknown>>('integrations/health', {});
              if (r) setHealth(r);
            }}
          >
            {busy ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />} Test
            connections
          </button>
        </div>
        <p>
          Checks database reachability, Walrus relayer health and Tatum’s Sui Mainnet chain
          identifier. Relayer health alone does not prove a memory write or delegate authorization.
        </p>
        {health && <pre className="diagnostic-output">{JSON.stringify(health, null, 2)}</pre>}
      </section>
    </>
  );
}
