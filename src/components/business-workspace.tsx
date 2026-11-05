'use client';
import Link from 'next/link';
import { useEffect, useState, useCallback, useRef, type FormEvent } from 'react';
import { api, Badge, Field, Modal, FindingList, Empty } from './ui';
import { InvoiceForm } from './forms';
import { SupplierTimeline } from './supplier-timeline';
import { ForwardingPanel } from './intake-inbox';
import type { BusinessSummary, BusinessSnapshot } from '@/lib/business-types';
import type { Assessment, Invoice, PaymentInstruction } from '@/lib/types';
import type { DocumentExtraction } from '@/lib/documents';
export function BusinessWorkspace({ authenticated }: { authenticated: boolean }) {
  const [organizations, setOrganizations] = useState<BusinessSummary[]>([]),
    [organizationId, setOrganization] = useState(''),
    [data, setData] = useState<BusinessSnapshot>(),
    [selected, setSelected] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [edit, setEdit] = useState<Invoice | 'new'>(),
    [document, setDocument] = useState<{
      extraction: DocumentExtraction;
      previewUrl?: string | null;
    }>(),
    [comparison, setComparison] = useState<{ off: Assessment; on: Assessment }>(),
    [instruction, setInstruction] = useState<PaymentInstruction>(),
    [version, setVersion] = useState(0);
  const operations = useRef(new Map<string, string>());
  const refresh = useCallback(async () => {
    if (!organizationId) return;
    try {
      const next = await api<BusinessSnapshot>('business/' + organizationId);
      setData(next);
      setSelected((v) => (next.invoices.some((i) => i.id === v) ? v : next.invoices[0]?.id || ''));
      setVersion((v) => v + 1);
    } catch (e) {
      setData(undefined);
      throw e;
    }
  }, [organizationId]);
  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    void api<BusinessSummary[]>('business')
      .then((rows) => {
        if (active) {
          setOrganizations(rows);
          setOrganization(rows[0]?.id || '');
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [authenticated]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setData(undefined);
      setComparison(undefined);
      void refresh().catch((e) => setError(e.message));
    }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);
  const invoice = data?.invoices.find((i) => i.id === selected),
    profile = data?.profiles.find((p) => p.vendorId === invoice?.vendorId);
  useEffect(() => {
    if (!organizationId || !selected) return;
    let active = true;
    void api<{ instruction?: PaymentInstruction }>('business/' + organizationId + '/context', {
      invoiceId: selected,
    })
      .then((r) => {
        if (active) setInstruction(r.instruction);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [organizationId, selected, version]);
  const canRequest = data && ['admin', 'requester'].includes(data.role),
    canVerify = data && ['admin', 'verifier'].includes(data.role);
  async function act(action: () => Promise<unknown>, success?: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      await refresh();
      if (success) setMessage(success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    await act(async () => {
      const r = await api<{ id: string }>('business', {
        name: f.get('name'),
        confirmWorkspaceSharing: f.get('sharing') === 'on',
      });
      setOrganizations(await api('business'));
      setOrganization(r.id);
    }, 'Business workspace created. Add a different wallet identity as verifier before proposing an approval.');
  }
  async function propose(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!invoice) return;
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = { invoiceId: invoice.id, note: f.get('note') };
    if (!profile)
      body.initialProfile = {
        trustedRecipient: invoice.recipient,
        emailDomain: f.get('domain'),
        contactLabel: f.get('label'),
        contactMethod: f.get('method'),
        contactReference: f.get('reference'),
        establishedAt: new Date(String(f.get('established'))).toISOString(),
        independentlySourced: f.get('independent') === 'on',
      };
    const fingerprint = JSON.stringify(body);
    if (!operations.current.has(fingerprint))
      operations.current.set(fingerprint, crypto.randomUUID());
    body.operationKey = operations.current.get(fingerprint);
    await act(
      () => api('business/' + organizationId + '/proposals', body),
      'Proposal saved. A different authorized verifier must review it.',
    );
  }
  async function openDocument(id: string) {
    await act(async () => {
      const r = await api<{
        id: string;
        extraction: DocumentExtraction;
        retained: boolean;
        previewUrl?: string | null;
      }>('business/' + organizationId + '/documents/' + id);
      setDocument({
        extraction: {
          ...r.extraction,
          documentId: r.id,
          retained: r.retained,
          duplicates: [],
          supplierMatches: [],
        },
        previewUrl: r.previewUrl,
      });
    });
  }
  if (!authenticated)
    return (
      <Empty title="Team verification uses private business records">
        <p>Sign in with your own wallet identity to create or join a business workspace.</p>
        <Link className="button primary" href="/connect">
          Sign in to your workspace
        </Link>
      </Empty>
    );
  return (
    <div className="business-workspace">
      <section className="notice">
        <div>
          <strong>Request. Independently verify. Keep the evidence.</strong>
          <p>
            A requester and verifier use separate authenticated identities. Supplier approval never
            signs or pays an invoice.
          </p>
        </div>
      </section>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {organizations.length > 0 && (
        <Field label="Business workspace">
          <select
            aria-label="Business workspace"
            value={organizationId}
            onChange={(e) => setOrganization(e.target.value)}
          >
            {organizations.map((o) => (
              <option value={o.id} key={o.id}>
                {o.name} · {o.role}
              </option>
            ))}
          </select>
        </Field>
      )}
      {!data && organizationId && <p role="status">Loading authorized business records…</p>}
      {organizations.length === 0 && (
        <section className="panel">
          <h2>Create your business workspace</h2>
          <p>
            The business uses the invoice and supplier records in your current private workspace.
            Only identities you explicitly add receive access. Service payments remain personal to
            their authenticated payer.
          </p>
          <form className="form-stack" onSubmit={create}>
            <Field label="Business name">
              <input name="name" required minLength={2} maxLength={100} />
            </Field>
            <label className="checkbox">
              <input name="sharing" type="checkbox" required />I authorize sharing this workspace’s
              supplier, invoice and verification records with the business members I add.
            </label>
            <button className="button primary" disabled={busy}>
              Create business workspace
            </button>
          </form>
        </section>
      )}
      {data && (
        <>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>{data.organization.name}</h2>
                <p>
                  Your role: <Badge tone="cyan">{data.role}</Badge>
                </p>
              </div>
              <button
                className="button outline"
                disabled={busy}
                onClick={() => void act(async () => {})}
              >
                Refresh workspace
              </button>
              {canRequest && (
                <button className="button primary" disabled={busy} onClick={() => setEdit('new')}>
                  Add or upload invoice
                </button>
              )}
            </div>
            <p className="small-text">
              Members sign in using their own wallet’s free personal-message authentication. No
              password, wallet secret or session transfer is shared.
            </p>
            <details>
              <summary>Members and role management</summary>
              <ul className="document-list">
                {data.members.map((m) => (
                  <li key={m.id}>
                    <div>
                      <strong>{m.wallet || m.name}</strong>
                      <small>
                        {m.role} · {m.revokedAt ? 'revoked' : 'active'}
                      </small>
                    </div>
                    {data.role === 'admin' && m.wallet && !m.revokedAt && (
                      <button
                        className="button outline small"
                        disabled={busy}
                        onClick={() =>
                          void act(
                            () =>
                              api('business/' + organizationId + '/members', {
                                wallet: m.wallet,
                                role: m.role,
                                revoke: true,
                              }),
                            'Membership revoked. Existing sessions no longer grant business access.',
                          )
                        }
                      >
                        Revoke membership
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {data.role === 'admin' && (
                <form
                  className="form-stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void act(
                      () =>
                        api('business/' + organizationId + '/members', {
                          wallet: f.get('wallet'),
                          role: f.get('role'),
                          revoke: false,
                        }),
                      'Membership saved. No email invitation was sent.',
                    );
                  }}
                >
                  <Field label="Existing member wallet">
                    <input
                      name="wallet"
                      required
                      pattern="0x[a-fA-F0-9]{64}"
                      placeholder="Their own wallet must first complete normal sign-in"
                    />
                  </Field>
                  <Field label="Business role">
                    <select aria-label="Business role" name="role" defaultValue="requester">
                      <option value="requester">Requester</option>
                      <option value="verifier">Verifier</option>
                      <option value="admin">Organization administrator</option>
                    </select>
                  </Field>
                  <button className="button outline" disabled={busy}>
                    Add or update authorized member
                  </button>
                </form>
              )}
            </details>
          </section>
          <ForwardingPanel
            base={'business/' + organizationId}
            canConfigure={data.role === 'admin'}
          />
          {!!data.documents.length && (
            <section className="panel">
              <h2>Document intake</h2>
              <ul className="document-list">
                {data.documents.map((d) => (
                  <li key={d.id}>
                    <div>
                      <strong>{d.filename}</strong>
                      <Badge>{d.status}</Badge>
                      <small>
                        {d.source} · {new Date(d.createdAt).toLocaleString()}
                      </small>
                    </div>
                    {canRequest && (
                      <div>
                        {d.status === 'review' && (
                          <button
                            className="button outline small"
                            disabled={busy}
                            onClick={() => void openDocument(d.id)}
                          >
                            Review extraction
                          </button>
                        )}
                        <button
                          className="button outline small"
                          disabled={busy}
                          onClick={() => {
                            if (
                              confirm(
                                'Delete this private attachment and extracted draft? Its invoice and audit remain.',
                              )
                            )
                              void act(
                                () =>
                                  api(
                                    'business/' + organizationId + '/documents/' + d.id,
                                    {},
                                    'DELETE',
                                  ),
                                'Document deleted.',
                              );
                          }}
                        >
                          Delete document
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="panel">
            <h2>Invoice review queue</h2>
            {data.invoices.length === 0 ? (
              <p>Add an invoice to start a maker-checker review.</p>
            ) : (
              <div className="business-invoice-list">
                {data.invoices.map((i) => (
                  <button
                    className={'business-invoice' + (i.id === selected ? ' selected' : '')}
                    key={i.id}
                    onClick={() => {
                      setSelected(i.id);
                      setComparison(undefined);
                    }}
                  >
                    <strong>{i.vendor}</strong>
                    <span>{i.number}</span>
                    <Badge>{i.status}</Badge>
                  </button>
                ))}
              </div>
            )}
          </section>
          {invoice && (
            <>
              <section className="panel">
                <div className="section-heading">
                  <h2>{invoice.number} · payment destination</h2>
                  {canRequest && invoice.status === 'open' && (
                    <button
                      className="button outline small"
                      disabled={busy}
                      onClick={() => setEdit(invoice)}
                    >
                      Edit invoice
                    </button>
                  )}
                </div>
                <dl className="detail-list">
                  <div>
                    <dt>Established destination</dt>
                    <dd>
                      <code>
                        {profile?.trustedRecipient || 'No independently established reference'}
                      </code>
                    </dd>
                  </div>
                  <div>
                    <dt>Proposed destination</dt>
                    <dd>
                      <code>{invoice.recipient || 'Missing; review source and edit invoice'}</code>
                    </dd>
                  </div>
                  {profile && (
                    <div>
                      <dt>Established contact</dt>
                      <dd>
                        {profile.contactLabel} · {profile.contactMethod} ·{' '}
                        {profile.contactReference} · established{' '}
                        {new Date(profile.establishedAt).toLocaleString()}
                      </dd>
                    </div>
                  )}
                </dl>
                <button
                  className="button outline"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      const off = await api<Assessment>('business/' + organizationId + '/review', {
                        invoiceId: invoice.id,
                        memoryOn: false,
                      });
                      const on = await api<Assessment>('business/' + organizationId + '/review', {
                        invoiceId: invoice.id,
                        memoryOn: true,
                      });
                      setComparison({ off, on });
                    })
                  }
                >
                  Compare Memory OFF / ON
                </button>
                {comparison && (
                  <div className="comparison-grid">
                    {(['off', 'on'] as const).map((mode) => (
                      <section key={mode}>
                        <h3>Memory {mode.toUpperCase()}</h3>
                        <p>{comparison[mode].memoryStatus}</p>
                        <FindingList assessment={comparison[mode]} />
                        <p>Actually applied citations: {comparison[mode].citations.length}</p>
                      </section>
                    ))}
                  </div>
                )}
                {canRequest && invoice.status === 'open' && (
                  <details>
                    <summary>Record source payment instructions</summary>
                    <form
                      key={invoice.id + ':' + version}
                      className="form-stack"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void act(
                          () =>
                            api('business/' + organizationId + '/instructions', {
                              invoiceId: invoice.id,
                              senderEmail: f.get('sender'),
                              replyTo: f.get('reply'),
                              message: f.get('message'),
                              requestedContact: f.get('requested'),
                              receivedAt: new Date(String(f.get('received'))).toISOString(),
                            }),
                          'Instructions saved; prior proposals and approvals invalidated.',
                        );
                      }}
                    >
                      <Field label="Reported sender email">
                        <input
                          name="sender"
                          type="email"
                          required
                          defaultValue={instruction?.senderEmail}
                        />
                      </Field>
                      <Field label="Reported reply-to">
                        <input name="reply" type="email" defaultValue={instruction?.replyTo} />
                      </Field>
                      <Field label="Instruction text · untrusted">
                        <textarea
                          name="message"
                          required
                          minLength={5}
                          maxLength={3000}
                          defaultValue={instruction?.message || invoice.memo}
                        />
                      </Field>
                      <Field label="Contact supplied in request · never trusted automatically">
                        <input
                          name="requested"
                          maxLength={180}
                          defaultValue={instruction?.requestedContact}
                        />
                      </Field>
                      <Field label="When the request was received">
                        <input
                          name="received"
                          type="datetime-local"
                          required
                          defaultValue={instruction?.receivedAt.slice(0, 16)}
                        />
                      </Field>
                      <button className="button outline" disabled={busy}>
                        Save reported instructions
                      </button>
                    </form>
                  </details>
                )}
                {canRequest && invoice.status === 'open' && (
                  <form className="form-stack" key={'proposal:' + invoice.id} onSubmit={propose}>
                    <h3>Request independent verification</h3>
                    {!profile && (
                      <>
                        <p>
                          No trusted contact exists. Propose an independently sourced initial
                          reference for a separate verifier to check.
                        </p>
                        <Field label="Established supplier email domain">
                          <input name="domain" required placeholder="supplier.example" />
                        </Field>
                        <Field label="Known contact / role">
                          <input name="label" required minLength={2} />
                        </Field>
                        <Field label="Independent contact channel">
                          <select name="method">
                            <option value="phone">Known phone</option>
                            <option value="in_person">In person</option>
                            <option value="secure_portal">Established secure portal</option>
                          </select>
                        </Field>
                        <Field label="Independently sourced contact reference">
                          <input name="reference" required minLength={5} maxLength={180} />
                        </Field>
                        <Field label="Contact established at">
                          <input name="established" type="datetime-local" required />
                        </Field>
                        <label className="checkbox">
                          <input type="checkbox" name="independent" required />
                          This contact was sourced independently, outside the payment-change
                          request.
                        </label>
                      </>
                    )}
                    <Field label="Reason and source evidence for this proposal">
                      <textarea name="note" required minLength={12} maxLength={1000} />
                    </Field>
                    <button className="button primary" disabled={busy || !invoice.recipient}>
                      Submit verification request
                    </button>
                  </form>
                )}
              </section>
              <section className="panel">
                <h2>Verification requests</h2>
                {data.changes.filter((p) => p.invoiceId === invoice.id).length === 0 && (
                  <p>No proposal has been submitted for this invoice. Approval stays held.</p>
                )}
                {data.changes
                  .filter((p) => p.invoiceId === invoice.id)
                  .map((p) => (
                    <article className="business-proposal" key={p.id}>
                      <Badge tone={p.state === 'approved' ? 'mint' : 'amber'}>
                        {Date.parse(p.expiresAt) <= Date.parse(data.checkedAt)
                          ? 'expired · ' + p.state
                          : p.state}
                      </Badge>
                      <p className="small-text">
                        Submitted {new Date(p.createdAt).toLocaleString()} · verification expires{' '}
                        {new Date(p.expiresAt).toLocaleString()}
                      </p>
                      <p>{p.note}</p>
                      <dl className="detail-list">
                        <div>
                          <dt>Requester identity</dt>
                          <dd>
                            <code>
                              {data.members.find((m) => m.id === p.proposedBy)?.wallet ||
                                p.proposedBy}
                            </code>
                          </dd>
                        </div>
                        <div>
                          <dt>Previous reference</dt>
                          <dd>
                            <code>{p.previousRecipient || 'No established reference'}</code>
                          </dd>
                        </div>
                        <div>
                          <dt>Proposed destination</dt>
                          <dd>
                            <code>{p.proposedRecipient}</code>
                          </dd>
                        </div>
                        <div>
                          <dt>Verifier identity</dt>
                          <dd>
                            <code>
                              {data.members.find((m) => m.id === p.checkedBy)?.wallet ||
                                p.checkedBy ||
                                'Awaiting a different authorized verifier'}
                            </code>
                          </dd>
                        </div>
                      </dl>
                      {p.decision && (
                        <details>
                          <summary>Recorded decision evidence</summary>
                          <pre className="source-text">{JSON.stringify(p.decision, null, 2)}</pre>
                        </details>
                      )}
                      {['pending', 'clarification'].includes(p.state) &&
                        p.proposedBy === data.actorId && (
                          <p role="status">
                            You proposed this request. Another authenticated member must verify it;
                            changing your role cannot permit self-approval.
                          </p>
                        )}
                      {canVerify &&
                        p.proposedBy !== data.actorId &&
                        ['pending', 'clarification'].includes(p.state) &&
                        Date.parse(p.expiresAt) > Date.parse(data.checkedAt) && (
                          <form
                            className="form-stack"
                            onSubmit={(e) => {
                              e.preventDefault();
                              const f = new FormData(e.currentTarget);
                              void act(
                                () =>
                                  api(
                                    'business/' +
                                      organizationId +
                                      '/proposals/' +
                                      p.id +
                                      '/decision',
                                    {
                                      outcome: f.get('outcome'),
                                      method: f.get('method'),
                                      note: f.get('note'),
                                      evidenceReference: f.get('evidence'),
                                      usedEstablishedContact: f.get('established') === 'on',
                                    },
                                  ),
                                'Independent decision recorded. It does not authorize a payment.',
                              );
                            }}
                          >
                            <Field label="Independent verification outcome">
                              <select aria-label="Independent verification outcome" name="outcome">
                                <option value="confirmed">Confirm the proposed destination</option>
                                <option value="rejected">Reject the change</option>
                                <option value="clarification">Request clarification</option>
                              </select>
                            </Field>
                            <Field label="Channel actually used">
                              <select aria-label="Channel actually used" name="method">
                                <option value="phone">Known phone</option>
                                <option value="in_person">In person</option>
                                <option value="secure_portal">Established secure portal</option>
                              </select>
                            </Field>
                            <Field label="Evidence reference · private">
                              <input name="evidence" required minLength={5} maxLength={180} />
                            </Field>
                            <Field label="What you independently verified">
                              <textarea name="note" required minLength={12} maxLength={1000} />
                            </Field>
                            <label className="checkbox">
                              <input type="checkbox" name="established" required />I used the
                              independently established contact, not a contact supplied in this
                              request.
                            </label>
                            <button className="button primary" disabled={busy}>
                              Record independent decision
                            </button>
                          </form>
                        )}
                      {p.state === 'approved' &&
                        Date.parse(p.expiresAt) > Date.parse(data.checkedAt) && (
                          <details>
                            <summary>Propose minimized learning for owner review</summary>
                            <form
                              className="form-stack"
                              onSubmit={(e) => {
                                e.preventDefault();
                                const f = new FormData(e.currentTarget);
                                void act(async () => {
                                  const r = await api<{ message: string }>(
                                    'business/' + organizationId + '/learning',
                                    {
                                      invoiceId: invoice.id,
                                      summary: f.get('summary'),
                                      confirmMinimized: f.get('minimized') === 'on',
                                    },
                                  );
                                  setMessage(r.message);
                                });
                              }}
                            >
                              <p>
                                This saves a review candidate in the application. It makes no Walrus
                                write. The owner separately approves exact minimized content and
                                costs.
                              </p>
                              <Field label="Policy summary without private contact or account details">
                                <textarea name="summary" required minLength={12} maxLength={500} />
                              </Field>
                              <label className="checkbox">
                                <input name="minimized" type="checkbox" required />I removed private
                                payment and contact details.
                              </label>
                              <button className="button outline" disabled={busy}>
                                Save learning candidate · no Mainnet write
                              </button>
                            </form>
                          </details>
                        )}
                    </article>
                  ))}
              </section>
              <SupplierTimeline
                key={invoice.vendorId + ':' + version}
                vendorId={invoice.vendorId}
                organizationId={organizationId}
              />
            </>
          )}
        </>
      )}
      {edit && (
        <Modal
          title={edit === 'new' ? 'Add or upload business invoice' : 'Edit business invoice'}
          onClose={() => setEdit(undefined)}
        >
          <InvoiceForm
            invoice={edit === 'new' ? undefined : edit}
            extractPath={'business/' + organizationId + '/extract'}
            savePath={
              'business/' + organizationId + '/invoices' + (edit === 'new' ? '' : '/' + edit.id)
            }
            busy={busy}
            setBusy={setBusy}
            notify={(s, failed) => (failed ? setError(s) : setMessage(s))}
            onSaved={(id) => {
              setEdit(undefined);
              setSelected(id);
              void refresh();
            }}
          />
        </Modal>
      )}
      {document && (
        <Modal title="Review forwarded invoice" onClose={() => setDocument(undefined)}>
          <InvoiceForm
            key={document.extraction.documentId}
            initialExtraction={document.extraction}
            previewUrl={document.previewUrl}
            extractPath={'business/' + organizationId + '/extract'}
            savePath={'business/' + organizationId + '/invoices'}
            busy={busy}
            setBusy={setBusy}
            notify={(s, failed) => (failed ? setError(s) : setMessage(s))}
            onSaved={(id) => {
              setDocument(undefined);
              setSelected(id);
              void refresh();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
