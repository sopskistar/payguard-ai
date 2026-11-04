# Judge? Start Here

**[Watch the 2:46 Demo](https://youtu.be/i2ZsEPIegy4)**

**[Try PayGuard without a wallet](https://payguard-ai-henna.vercel.app/try)**

**[Compare Walrus Memory OFF/ON](https://payguard-ai-henna.vercel.app/courtroom)**

**[Inspect verified Sui Mainnet payments](https://payguard-ai-henna.vercel.app/proof)**

Watch the film for the complete story, or use the three-minute walkthrough below. Every public step is free: no wallet connection, account, administrator access or payment is needed.

## Three minutes with the product

### 0:00–1:15 · Detect the changed destination

Open the **Public Demo**. The supplier and invoice are synthetic. Compare the established recipient with the proposed destination, inspect the risk findings and see why approval stays on hold. The practice human-verification step illustrates an independent check; it does not prove that a real supplier was contacted.

The suspicious text replay shows why an invoice cannot instruct the system to ignore its safeguards. Changing invoice text does not remove the human verification requirement. PayGuard reviews instructions; it does not send supplier payments.

### 1:15–2:15 · See what memory contributes

Open **Memory Courtroom**, select Experiment 3, and compare Memory OFF with ON. Expand the citations to inspect actual confirmed Walrus job/blob references. OFF returned zero citations; ON returned seven in the captured comparison. Both retain the baseline findings and human hold.

This is a **November 1 recorded application replay**, not a new live recall from your anonymous browser. It demonstrates how relevant past decisions add context without authorizing a payment. Separate fresh-session provider checks are linked below.

### 2:15–3:00 · Inspect the payment evidence

Open **Mainnet Proof**. Inspect the three Sui transactions, exact **0.001 SUI merchant credit per settlement**, and the delivered analysis/receipt evidence. Tatum's native Sui gRPC integration independently checks network, successful execution, recipient, amount and transaction effects. It does not certify supplier identity or the truth of an invoice.

The payments are real **developer-controlled service experiments** using synthetic invoices. They pay for PayGuard analysis, not supplier invoices, and do not establish customer adoption. Reopening the saved reports did not charge again. An unrelated transaction shown during the invoice-review demo is deliberately not proof of that invoice's payment; the settled service transactions are on `/proof`.

## Evidence at a glance

| Evidence                   | Verified scope                                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Walrus records             | **33 confirmed as of November 3, 2026**: original 32 plus one member correction; completed jobs and matching blobs rechecked. The public Courtroom's 32-record snapshot remains dated November 1. |
| Cross-session context      | Real SDK recalls with owned blob/text provenance; tenant-scoped application checks and unchanged mandatory holds.                                                                                 |
| Learning evaluation        | **18/18 authored synthetic contracts**, November 1; four actual recall queries. Not a real-world detection accuracy estimate.                                                                     |
| Mainnet service payments   | **3 settlements / 0.003 SUI total merchant credit / 3 persisted reports**, independently rechecked November 3.                                                                                    |
| Customer wallet acceptance | Free Nightly sign-in and private authoring are owner-confirmed. Physical production financial signing is **not independently verified**.                                                          |

## Supporting documentation

- [Walrus comparison and learning methodology](MEMORY_EVALUATION.md) · [completed provider references](evidence/recovered-walrus-provider-check.json).
- [Mainnet transaction links and receipts](MAINNET_PROOF.md) · [November 3 independent reconciliation](evidence/nightly-account-reconciliation.json).
- [Architecture](ARCHITECTURE.md) · [x402 protocol](AGENT_PAYMENTS.md) · [test ledger](TEST_RESULTS.md).
- [Security boundaries](WALLET_SECURITY.md) · [Nightly acceptance and unresolved-intent safeguards](NIGHTLY_ACCOUNT_SELECTION_2026-11-03.md).

## Optional private workspace

A supported wallet can authenticate through a free personal-message signature, then create an isolated synthetic supplier and invoice. This is separate from financial authorization. Judges need no funds, and the public evaluation is complete without checkout. Historical ambiguous payment attempts remain governed by reconciliation safeguards; do not request a replacement signature simply because a quote expired.
