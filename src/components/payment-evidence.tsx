import payments from '../../docs/evidence/mainnet-service-reconciliation.json';
export function PaymentEvidence({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className="payment-evidence"
      id="mainnet-purchases"
      aria-label="Verified Mainnet purchases"
    >
      <div className="evidence-section-heading">
        <div>
          <span className="site-eyebrow">THREE REAL PURCHASES · SYNTHETIC INVOICES</span>
          <h2>Follow the payment. Inspect the report.</h2>
        </div>
        <strong>
          {payments.payments.length} receipts · {Number(payments.settledTotalAtomic) / 1e9} SUI
        </strong>
      </div>
      <p>
        Payer and merchant are different accounts controlled by the developer for these experiments.
        Recorded Tatum Mainnet verification: {payments.checkedAt}. Replay and receipt inspection
        never sign or submit.
      </p>
      <ol className="payment-evidence-flow">
        <li>Invoice anomaly</li>
        <li>HTTP 402</li>
        <li>Exact approval</li>
        <li>Wallet signature</li>
        <li>Tentacle</li>
        <li>Tatum</li>
        <li>Saved report</li>
      </ol>
      <div className="payment-evidence-grid">
        {payments.payments.map((p, index) => (
          <article key={p.digest}>
            <span className="site-eyebrow">EXPERIMENT 0{index + 1} · FINALIZED</span>
            <h3>{p.invoice}</h3>
            <p className="evidence-credit">
              0.001 SUI <span>verified merchant credit</span>
            </p>
            <a
              className="inline-link evidence-digest"
              href={p.explorer}
              target="_blank"
              rel="noreferrer"
            >
              {p.digest} ↗
            </a>
            <p>
              Checkpoint {p.checkpoint} · payer gas {Number(p.payerGasAtomic) / 1e9} SUI · sponsor
              gas {Number(p.sponsorGasAtomic) / 1e9} SUI.
            </p>
            <details>
              <summary>Inspect quote, settlement and delivered report</summary>
              <dl className="detail-list">
                <div>
                  <dt>Quote / intent</dt>
                  <dd>
                    <code>{p.quoteId}</code>
                  </dd>
                </div>
                <div>
                  <dt>Receipt</dt>
                  <dd>
                    <code>{p.receiptId}</code>
                  </dd>
                </div>
                <div>
                  <dt>Payer</dt>
                  <dd>
                    <code>{p.payer}</code>
                  </dd>
                </div>
                <div>
                  <dt>Merchant</dt>
                  <dd>
                    <code>{p.merchant}</code>
                  </dd>
                </div>
                <div>
                  <dt>Gas sponsor</dt>
                  <dd>
                    <code>{p.sponsor}</code>
                  </dd>
                </div>
                <div>
                  <dt>Authorization binding</dt>
                  <dd>
                    Exact approved bytes executed; prepared digest matches execution.{' '}
                    {p.settlementRequests} settlement submission recorded.
                  </dd>
                </div>
                <div>
                  <dt>Original HTTP 402</dt>
                  <dd>
                    {p.challenge.x402Version === 2 ? 'x402 v2' : 'Inspect source'} · exact ·{' '}
                    {p.challenge.accepts[0].amount} MIST · {p.challenge.accepts[0].network}
                  </dd>
                </div>
              </dl>
              <p>
                <strong>Delivered result:</strong> {p.result.recommendation}
              </p>
              <pre className="service-result">{JSON.stringify(p.result, null, 2)}</pre>
            </details>
            {!compact && (
              <p>
                Supplier identity and human approval remain separate from this first-party analysis
                purchase.
              </p>
            )}
          </article>
        ))}
      </div>
      <details>
        <summary>Why an explorer summary can show 0.0009 SUI</summary>
        <p>
          Actual effects show 0.001 SUI credited to the merchant and 0.001 SUI debited from the
          payer. The sponsor separately paid 0.0001 SUI in each transaction. Subtracting that
          separate gas charge from the service fee produces 0.0009, but that value is not the
          merchant balance change. The original summary screen’s aggregation rule was not captured;
          no hidden merchant fee is established.
        </p>
      </details>
      <a
        className="inline-link"
        href="https://github.com/sopskistar/payguard-ai/blob/main/docs/evidence/mainnet-service-reconciliation.json"
        target="_blank"
        rel="noreferrer"
      >
        Full effects, original challenges, audit events and report provenance ↗
      </a>
    </section>
  );
}
