'use client';
import type { Extraction } from '@/lib/intake';
import { Badge } from './ui';
export function ExtractionReview({
  extraction,
  previewUrl,
}: {
  extraction: Extraction;
  previewUrl?: string | null;
}) {
  return (
    <section className="extraction-review" aria-label="Source document review">
      <h3>Review the source before saving</h3>
      <p>
        <strong>Source:</strong> {extraction.metadata.filename}
      </p>
      <p>{extraction.message}</p>
      {!!extraction.missing?.length && (
        <p>
          <Badge tone="amber">Missing fields</Badge> {extraction.missing.join(', ')}
        </p>
      )}
      {extraction.warnings?.map((w) => (
        <p role="status" key={w}>
          {w}
        </p>
      ))}
      {!!Object.keys(extraction.uncertain || {}).length && (
        <dl className="detail-list">
          {Object.entries(extraction.uncertain!).map(([k, v]) => (
            <div key={k}>
              <dt>Uncertain {k}</dt>
              <dd>{v.join(' · ')}</dd>
            </div>
          ))}
        </dl>
      )}
      {(extraction.preview || previewUrl) && (
        <details open>
          <summary>Source preview · rendered pixels</summary>
          {/* Source pixels are produced by the server; no PDF actions or HTML are embedded. */}
          <img
            src={extraction.preview || previewUrl!}
            alt="Invoice source preview. Compare the editable fields with this document."
            className="document-preview"
          />
        </details>
      )}
      {extraction.sourceText && (
        <details>
          <summary>Extracted source text · untrusted</summary>
          <pre className="source-text">{extraction.sourceText}</pre>
        </details>
      )}
      {!!extraction.paymentDetails?.length && (
        <details>
          <summary>Detected payment instructions</summary>
          <ul>
            {extraction.paymentDetails.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </details>
      )}
      {!!extraction.contacts?.length && (
        <p>Source contacts, unverified: {extraction.contacts.join(' · ')}</p>
      )}
      {!!extraction.links?.length && (
        <details>
          <summary>Embedded links · not opened automatically</summary>
          <ul>
            {extraction.links.map((v) => (
              <li key={v}>
                <code>{v}</code>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
