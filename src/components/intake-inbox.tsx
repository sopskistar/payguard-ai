'use client';
import { useEffect, useState, useCallback } from 'react';
import { api, Badge, Modal } from './ui';
import { InvoiceForm } from './forms';
import type { DocumentExtraction } from '@/lib/documents';
export function ForwardingPanel({
  base = 'intake',
  canConfigure = true,
}: {
  base?: string;
  canConfigure?: boolean;
}) {
  const [status, setStatus] = useState<{
      configuration: { configured: boolean; missing: string[] };
      route: { address: string; enabled: boolean } | null;
    }>(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setStatus(await api(base + '/forwarding'));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [base]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);
  async function enable() {
    setBusy(true);
    try {
      setStatus(await api(base + '/forwarding', { confirmEnable: true }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="panel">
      <summary>Forward supplier invoices by email</summary>
      {error && <p role="alert">{error}</p>}
      {status && (
        <>
          <p>
            Forwarded attachments enter source review. Email addresses and sender authentication
            never approve a supplier destination.
          </p>
          {status.configuration.configured ? (
            <>
              {status.route ? (
                <p>
                  <Badge tone="mint">Intake address</Badge> <code>{status.route.address}</code>
                </p>
              ) : canConfigure ? (
                <button className="button outline" disabled={busy} onClick={() => void enable()}>
                  Create a private intake address
                </button>
              ) : (
                <p>An organization administrator can create the intake address.</p>
              )}
              <p className="small-text">
                Only messages delivered by the verified provider webhook are accepted. Attachments
                remain private and require human review.
              </p>
            </>
          ) : (
            <p role="status">
              Live email intake is not configured. The application owner must connect:{' '}
              {status.configuration.missing.join(', ')}. You can upload documents now; no API key is
              requested from workspace members.
            </p>
          )}
        </>
      )}
    </details>
  );
}
export function IntakeInbox({
  base = 'intake',
  businessId,
  onChanged,
  canEdit = true,
}: {
  base?: string;
  businessId?: string;
  onChanged: () => void;
  canEdit?: boolean;
}) {
  const [documents, setDocuments] = useState<
      { id: string; filename: string; status: string; source: string; createdAt: string }[]
    >([]),
    [review, setReview] = useState<{
      extraction: DocumentExtraction;
      previewUrl?: string | null;
    }>(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const load = useCallback(async () => {
    try {
      if (businessId) return;
      setDocuments(await api(base + '/documents'));
    } catch (e) {
      setMessage((e as Error).message);
    }
  }, [base, businessId]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);
  async function open(id: string) {
    setBusy(true);
    try {
      const r = await api<{
        id: string;
        extraction: DocumentExtraction;
        retained: boolean;
        previewUrl?: string | null;
      }>(base + '/documents/' + id);
      setReview({
        extraction: {
          ...r.extraction,
          documentId: r.id,
          retained: r.retained,
          duplicates: [],
          supplierMatches: [],
        },
        previewUrl: r.previewUrl,
      });
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <ForwardingPanel base={base} />
      {!businessId && (
        <section className="panel">
          <h2>Document intake</h2>
          <p>
            Upload from Add Invoice, or review a forwarded document here. Source files are retained
            only when private storage is configured.
          </p>
          {message && <p role="status">{message}</p>}
          {documents.length === 0 ? (
            <p>No documents awaiting review.</p>
          ) : (
            <ul className="document-list">
              {documents.map((d) => (
                <li key={d.id}>
                  <div>
                    <strong>{d.filename}</strong> <Badge>{d.status}</Badge>
                    <small>
                      {d.source} · {new Date(d.createdAt).toLocaleString()}
                    </small>
                  </div>
                  <div>
                    {d.status === 'review' && canEdit && (
                      <button
                        className="button outline small"
                        disabled={busy}
                        onClick={() => void open(d.id)}
                      >
                        Review extraction
                      </button>
                    )}
                    {canEdit && (
                      <button
                        className="button outline small"
                        disabled={busy}
                        onClick={async () => {
                          if (
                            !confirm(
                              'Delete the retained attachment and extracted draft? Saved invoices and audit records remain.',
                            )
                          )
                            return;
                          setBusy(true);
                          try {
                            await api(base + '/documents/' + d.id, {}, 'DELETE');
                            await load();
                          } catch (e) {
                            setMessage((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Delete document
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {review && (
        <Modal title="Review invoice extraction" onClose={() => setReview(undefined)}>
          <InvoiceForm
            key={review.extraction.documentId}
            initialExtraction={review.extraction}
            previewUrl={review.previewUrl}
            busy={busy}
            setBusy={setBusy}
            notify={setMessage}
            onSaved={() => {
              setReview(undefined);
              void load();
              onChanged();
            }}
          />
        </Modal>
      )}
    </>
  );
}
