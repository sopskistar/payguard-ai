'use client';
import { useState, type FormEvent } from 'react';
import { Upload, LockKeyhole } from 'lucide-react';
import type { Invoice, Assessment } from '@/lib/types';
import { api, Field, Submit, Badge } from './ui';
import type { DocumentExtraction } from '@/lib/documents';
import { ExtractionReview } from './extraction-review';
const today = new Date().toISOString().slice(0, 10);
export function InvoiceForm({
  invoice,
  onSaved,
  busy,
  setBusy,
  notify,
  extractPath = 'invoices/extract',
  savePath,
  initialExtraction,
  previewUrl,
}: {
  invoice?: Invoice;
  extractPath?: string;
  savePath?: string;
  initialExtraction?: DocumentExtraction;
  previewUrl?: string | null;
  onSaved: (id: string) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  notify: (s: string, error?: boolean) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({
    ...initialExtraction?.fields,
    vendor: (initialExtraction?.fields.vendor ?? invoice?.vendor) || '',
    number: (initialExtraction?.fields.number ?? invoice?.number) || '',
    issued: initialExtraction ? initialExtraction.fields.issued || '' : invoice?.issued || today,
    due: initialExtraction ? initialExtraction.fields.due || '' : invoice?.due || today,
    amount: (initialExtraction?.fields.amount ?? invoice?.amount) || '',
    currency: initialExtraction
      ? initialExtraction.fields.currency || ''
      : invoice?.currency || 'USD',
    memo: (initialExtraction?.fields.memo ?? invoice?.memo) || '',
    recipient: (initialExtraction?.fields.recipient ?? invoice?.recipient) || '',
    wallet: (initialExtraction?.fields.wallet ?? invoice?.wallet) || '',
    coinType: (initialExtraction?.fields.coinType ?? invoice?.coinType) || '',
    tokenAmount: (initialExtraction?.fields.tokenAmount ?? invoice?.tokenAmount) || '',
  });
  const [source, setSource] = useState<Invoice['source']>(
    initialExtraction ? initialExtraction.source || 'email' : invoice?.source || 'manual',
  );
  const [extraction, setExtraction] = useState<DocumentExtraction | undefined>(initialExtraction);
  const [processing, setProcessing] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [confirmedExtraction, setConfirmedExtraction] = useState(false);
  const [importKey] = useState(() => crypto.randomUUID());
  const change = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setProcessing(true);
    setUploadError('');
    setConfirmedExtraction(false);
    try {
      const data = new FormData();
      data.set('file', file);
      const result = await api<DocumentExtraction>(extractPath, data);
      setExtraction(result);
      setValues({
        vendor: '',
        number: '',
        issued: '',
        due: '',
        amount: '',
        currency: '',
        memo: '',
        recipient: '',
        wallet: '',
        coinType: '',
        tokenAmount: '',
        ...result.fields,
      });
      setConfirmedExtraction(false);
      setSource(result.source || 'image');
      notify(result.message);
    } catch (e) {
      setUploadError((e as Error).message);
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
      setProcessing(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await api<{ id: string }>(
        savePath || (invoice ? `invoices/${invoice.id}` : 'invoices'),
        {
          ...values,
          importKey,
          isDemo: invoice?.isDemo || false,
          source,
          extraction: extraction?.metadata,
          documentId: extraction?.documentId,
          confirmExtraction: confirmedExtraction,
        },
        invoice ? 'PATCH' : 'POST',
      );
      onSaved(result.id);
      notify('Invoice saved and reviewed.');
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="form-stack">
      <label className="upload-area">
        <Upload size={24} />
        <strong>Start with an invoice</strong>
        <span>PDF, PNG, JPEG, WebP, TXT or CSV · up to 3 MB</span>
        <input
          aria-label="Upload invoice"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv"
          disabled={busy}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            void upload(file);
          }}
        />
      </label>
      {uploadError && (
        <div className="notice" role="alert">
          <div>
            <strong>The selected file was not processed.</strong>
            <p>{uploadError}</p>
            <p>Any earlier source shown below has not been replaced.</p>
            <button
              type="button"
              className="button outline small"
              onClick={() => {
                setUploadError('');
                setExtraction(undefined);
                setSource('manual');
                setConfirmedExtraction(false);
              }}
            >
              Enter details manually
            </button>
          </div>
        </div>
      )}
      {processing && (
        <p role="status">
          Processing the source document… PDF and English OCR extraction may take up to 40 seconds.
        </p>
      )}
      {extraction && (
        <>
          <ExtractionReview extraction={extraction} previewUrl={previewUrl} />
          <p className="small-text">
            {extraction.retained
              ? 'Private source retained for up to seven days of review access. You can delete it in Invoice Inbox.'
              : 'Source processed ephemerally; no raw attachment was stored. Keep your local original.'}
          </p>
          {extraction.supplierMatches?.map((match) => (
            <div className="notice" key={match.id}>
              <div>
                <strong>
                  {match.match === 'exact'
                    ? 'Matching supplier name'
                    : 'Possible supplier; confirm the identity'}
                  : {match.name}
                </strong>
                <p>Proposed destination: {values.recipient || 'Missing'}</p>
                <p>
                  Established destination:{' '}
                  {match.establishedRecipient || 'No established reference'}
                </p>
                <button
                  type="button"
                  className="button outline small"
                  onClick={() => change('vendor', match.name)}
                >
                  Use this supplier name
                </button>
                <small>A name match never establishes trust.</small>
              </div>
            </div>
          ))}
          {!!extraction.duplicates?.length && (
            <p role="alert">
              Possible duplicate invoices: {extraction.duplicates.map((d) => d.number).join(', ')}.
              Review the saved invoice before importing another.
            </p>
          )}
        </>
      )}
      <div className="form-grid">
        {[
          ['vendor', 'Vendor / merchant', 'text'],
          ['number', 'Invoice number', 'text'],
          ['issued', 'Issued date', 'date'],
          ['due', 'Due date', 'date'],
          ['amount', 'Invoice amount', 'text'],
          ['currency', 'Currency', 'text'],
        ].map(([key, label, type]) => (
          <Field
            label={label}
            key={key}
            hint={
              extraction?.metadata.fields[key]
                ? `${extraction.metadata.fields[key].source} · ${extraction.metadata.fields[key].confidence}`
                : undefined
            }
          >
            <input
              required
              type={type}
              value={values[key]}
              maxLength={key === 'vendor' ? 100 : 80}
              inputMode={key === 'amount' ? 'decimal' : undefined}
              onChange={(e) => change(key, e.target.value)}
            />
          </Field>
        ))}
      </div>
      <details className="form-details" open={!!values.recipient || !!extraction}>
        <summary>Payment destination and optional Sui details</summary>
        <div className="form-stack">
          <Field label="Proposed payment destination">
            <input
              value={values.recipient}
              onChange={(e) => change('recipient', e.target.value)}
              placeholder="Full Sui address, iban:GB… or bank:account reference"
            />
          </Field>
          <Field label="Coin type">
            <input
              value={values.coinType}
              onChange={(e) => change('coinType', e.target.value)}
              placeholder="0x2::sui::SUI"
            />
          </Field>
          <Field
            label="Agreed token amount"
            hint="Explicit token units, independent of invoice currency. No exchange rate is assumed."
          >
            <input
              inputMode="decimal"
              value={values.tokenAmount}
              onChange={(e) => change('tokenAmount', e.target.value)}
              placeholder="e.g. 500"
            />
          </Field>
          <Field label="Related watch-only wallet">
            <input
              value={values.wallet}
              onChange={(e) => change('wallet', e.target.value)}
              placeholder="Optional full Sui address"
            />
          </Field>
        </div>
      </details>
      <Field label="Memo">
        <textarea
          value={values.memo}
          maxLength={1000}
          onChange={(e) => change('memo', e.target.value)}
          rows={2}
        />
      </Field>
      {extraction && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={confirmedExtraction}
            onChange={(e) => setConfirmedExtraction(e.target.checked)}
            required
          />
          I reviewed the source, corrected uncertain fields and checked the proposed payment
          destination. This does not establish supplier trust.
        </label>
      )}
      <div className="form-footer">
        <span>
          <LockKeyhole size={14} /> Saved privately to your workspace
        </span>
        <Submit busy={busy} disabled={!!uploadError || (!!extraction && !confirmedExtraction)}>
          Save & review invoice
        </Submit>
      </div>
    </form>
  );
}
export function CorrectionForm({
  invoice,
  assessment,
  onSaved,
  busy,
  setBusy,
  notify,
  configured,
}: {
  invoice: Invoice;
  assessment: Assessment;
  onSaved: () => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  notify: (s: string, error?: boolean) => void;
  configured: boolean;
}) {
  const [kind, setKind] = useState('verify_address');
  const [scope, setScope] = useState('vendor');
  const [future, setFuture] = useState(configured);
  const [value, setValue] = useState('');
  const [op] = useState(() => crypto.randomUUID());
  const preview =
    kind === 'verify_address'
      ? 'Always require independent verification for new or changed payout addresses.'
      : kind === 'threshold'
        ? `Require manual approval above ${value || '…'} in the configured review currency.`
        : kind === 'duplicate'
          ? 'Compare service periods and line items on future duplicate matches.'
          : kind === 'exception'
            ? 'A human confirmed an exception. Check applicability; never suppress mandatory safety checks.'
            : 'Escalate future recipient changes or repeated billing patterns after a previous incident.';
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const r = await api<{ status: string }>('corrections', {
        invoiceId: invoice.id,
        findingId: form.get('findingId'),
        action: form.get('action'),
        explanation: form.get('explanation'),
        scope,
        future,
        kind,
        value,
        hard: form.get('hard') === 'on',
        consent: form.get('consent') === 'on',
        operationKey: op,
      });
      notify(
        r.status === 'confirmed'
          ? 'Mainnet memory confirmed. Recheck to test recall.'
          : r.status === 'pending'
            ? 'Correction saved. Memory is pending; resume its status in Memory Lab.'
            : 'Correction saved.',
      );
      onSaved();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form-stack" onSubmit={submit}>
      <p>
        Teach the next review with an explicit correction for <strong>{invoice.vendor}</strong>.
        Your detailed explanation stays in Neon.
      </p>
      <div className="form-grid">
        <Field label="Which finding?">
          <select name="findingId">
            {assessment.findings.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
            <option value="overall">Overall assessment</option>
          </select>
        </Field>
        <Field label="Review action">
          <select name="action">
            <option value="remember">Remember this rule</option>
            <option value="correct">Correct this assessment</option>
            <option value="exception">Mark confirmed exception</option>
            <option value="escalate">Escalate future matches</option>
            <option value="dismiss">Dismiss with reason</option>
          </select>
        </Field>
      </div>
      <Field label="Your explanation">
        <textarea
          required
          minLength={8}
          maxLength={1000}
          name="explanation"
          rows={3}
          placeholder="What was wrong, what did you verify, and what should happen next?"
        />
      </Field>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={future}
          disabled={!configured}
          onChange={(e) => setFuture(e.target.checked)}
        />
        Change future behavior through Walrus Memory
      </label>
      {!configured && (
        <div className="notice">
          Integration not configured. You can save a private correction; live memory writes require
          Neon and Walrus credentials.
        </div>
      )}
      {future && (
        <>
          <div className="form-grid">
            <Field label="Rule to apply">
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  if (e.target.value === 'exception') setScope('invoice');
                }}
              >
                <option value="verify_address">Verify new addresses</option>
                <option value="threshold">Manual approval threshold</option>
                <option value="escalate">Escalate future matches</option>
                <option value="duplicate">Review repeated billing</option>
                <option value="exception">Remember exception context</option>
              </select>
            </Field>
            <Field label="Scope">
              <select
                disabled={kind === 'exception'}
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                <option value="invoice">This invoice</option>
                <option value="vendor">This vendor</option>
                <option value="all">All invoices</option>
              </select>
            </Field>
          </div>
          {kind === 'threshold' && (
            <Field label="Threshold in workspace review currency">
              <input
                required
                value={value}
                onChange={(e) => setValue(e.target.value)}
                inputMode="decimal"
              />
            </Field>
          )}
          <label className="checkbox">
            <input name="hard" type="checkbox" />
            Mandatory rule: enforce even when Memory is OFF
          </label>
          <div className="memory-preview">
            <Badge tone="cyan">Minimized Mainnet payload</Badge>
            <p>{preview}</p>
            <small>
              Scope: {scope}.{' '}
              {kind === 'exception'
                ? 'Exception context expires after 30 days and covers this invoice only. '
                : ''}
              Includes pseudonymous vendor/policy references. Excludes vendor name, raw invoice,
              recipient and your explanation.
            </small>
          </div>
          <label className="checkbox">
            <input type="checkbox" name="consent" required />I approve storing this abstract policy
            on Walrus Mainnet. Deleting an invoice will not delete the memory; retention depends on
            storage epochs.
          </label>
        </>
      )}
      <Submit busy={busy}>
        {future ? 'Save correction & remember' : 'Save private correction'}
      </Submit>
    </form>
  );
}
