# Self-service customer checkout — November 9, 2026

The optional **Purchase deeper analysis · 0.001 SUI** action on invoice findings opens checkout for that saved invoice. Supplier verification and human holds remain independent of the first-party report fee. The protected README from commit `968a89b73016d4ea9dd33579bb50cbcc088e233f` is unchanged.

## Customer workflow

1. Authenticate, upload a PDF/image, inspect the rendered source, correct extracted fields and save the invoice.
2. Open the optional purchase action. Choose a compatible Sui signing wallet, connect it and confirm the authenticated account and network. Provider objects remain distinct even when adapters share names or IDs.
3. Review the purchase. Wallet capabilities, invoice eligibility, configuration, funding and wallet/public purchase limits are checked before the server creates its five-minute quote. The price, merchant and network must be explicitly approved.
4. Prepare the exact transaction, then use the separate wallet-approval button. The app requests one financial signature and permits one submission of those immutable bytes. A local durable attempt marker, server compare-and-set and duplicate operation key prevent duplicate clicks or a refresh from repeating the purchase.
5. While confirmation is delayed, checkout says **“Verifying your payment. You do not need to pay again.”** Status reads continue with bounded backoff, resume after reconnect/visibility changes, and restore the existing purchase after refresh. Saved history uses report/status actions without requiring an intent ID or copied digest.
6. A verified receipt delivers the persisted report automatically. Reopening it returns the same receipt without another charge. An existing report for unchanged invoice instructions cannot be purchased again through a new operation key.

Wallet Standard advertises account/chain capabilities; it does not provide a universal active-network query. Checkout therefore requires explicit network confirmation and rechecks the exact provider, authenticated payer and chain immediately before preparation and signing. It never substitutes a different adapter or falls back to an execution method.

## Confirmation after the browser closes

`reconcileServicePayment` is a separate receipt-only function. It cannot access a signing or facilitator submission path. Its durable queue is the existing `settling` intent and original persisted digest. Tatum independently verifies finalized execution and the expected merchant credit before report persistence. A locked transaction and existing unique receipt indexes allow concurrent request/job retries to create one receipt and one report-completion audit.

- A bounded Next.js `after()` continuation retries delayed confirmation after the initial response, using a fresh request-owned database pool.
- An authenticated server worker checks at most three persisted submitted purchases per invocation, rotating by least recent confirmation attempt. Provider failures retain the original reservation and queue entry.
- GitHub Actions invokes that worker every five minutes without a customer session. Scheduled delivery is best effort; it is not an exact five-minute SLA.
- Vercel Hobby permits daily Cron jobs, so a daily worker invocation is a fallback. `CRON_SECRET` is stored as a sensitive Production variable and encrypted Actions secret; it is absent from source and public evidence.

No worker can sign, prepare, submit, create a quote, release a financial hold or write Walrus memory. Historical recovery remains disabled. Already submitted legacy customer purchases use the same original-digest verification; administrator prepared holds remain excluded.

## Expired quotes

An unprepared, unattempted quote can be cancelled through checkout and replaced after explicit user action. A newly prepared customer checkout carries a server-owned eligibility marker for guarded unsigned expiry. Its cancellation still requires both Sui Mainnet and Tatum to prove the transaction's complete validity window is closed and unexecuted, with all reservation-ledger checks intact. A five-minute quote timer, absent wallet telemetry or `NOT_FOUND` alone never releases a prepared transaction.

Any wallet attempt, disclosed payload, submitted/uncertain transaction, provider disagreement, missing history or historical administrator hold stays protected. The historical operator recovery flag is not enabled or repurposed.

## Source retention

Vercel invokes `/api/intake-cleanup` daily at 06:00 UTC, with Hobby's hourly scheduling precision. Its existing constant-time Bearer authorization requires the Production secret. Each run considers at most ten expired source records, deletes retained source/preview objects through the existing provider safeguards, preserves invoice references, hashes and all prior audits, and appends retention audits. Failed provider deletion keeps the source record held; unexpired documents are excluded. The authenticated, same-origin administrator POST remains available.

## Acceptance scope

Automated tests use disposable local databases, real local customer authentication and PDF extraction/source review, with simulated wallets and financial providers. They cover wallet selection/account changes, no quote before readiness, exact purchase approval, one submission, delayed confirmation across refresh, report reopening, concurrent/idempotent workers, independent expiry proofs, scheduler authentication and bounded retention.

The owner reports that Nightly worked in another browser. That report is retained separately from the terminal SDK settlement and this release's automated signing fixtures. **No new physical wallet approval or Mainnet purchase is claimed for the changed checkout.** The owner decides whether to perform a further live acceptance purchase.

Final test counts and deployed identity are recorded in the release completion report and [validation ledger](evidence/customer-checkout-validation-20261109.json). The normal customer report history and `/api/release` expose current delivery/release status; no developer console or manual reconciliation is part of checkout.

Implementation references: [Sui Wallet Standard](https://docs.sui.io/onchain-finance/asset-custody/wallets/wallet-standard) for account authorization before signing; [Stripe fulfillment guidance](https://docs.stripe.com/checkout/fulfillment) for idempotent server delivery independent of browser return; [Vercel Cron limits](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing) and [Cron authentication](https://vercel.com/docs/schedules/cron-jobs/manage-cron-jobs) for the existing platform schedule. These informed interaction and delivery behavior; no visual redesign or Stripe integration was introduced.
