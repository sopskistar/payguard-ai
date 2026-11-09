# PayGuard Verify

**Verify before you pay. Remember what nearly went wrong.**

PayGuard Verify helps businesses spot changed supplier payment instructions, hold suspicious invoices for independent verification, and remember trusted decisions for future reviews.

[Live app](https://payguard-ai-henna.vercel.app/) · [Try the walkthrough](https://payguard-ai-henna.vercel.app/try) · [Approved demo](https://youtu.be/i2ZsEPIegy4) · [Mainnet proof](https://payguard-ai-henna.vercel.app/proof) · [Technical article](https://sopskistar.github.io/payguard-ai/)

[![Watch the PayGuard Verify demo](public/demo-approved-poster.png)](https://youtu.be/i2ZsEPIegy4)

*The approved video documents the original hackathon submission. Invoice forwarding, supplier timelines, and team verification were added afterward.*

## Why PayGuard exists

A supplier invoice can look legitimate even when its payment destination has changed. An email address, logo, or familiar business name is not enough to establish that new instructions are trustworthy.

PayGuard gives teams a place to compare the proposed destination with their established records, capture independent verification, and retain useful context without removing the human decision.

## How it works

1. **Receive an invoice.** Upload a PDF or image, forward an email, or enter the details manually.
2. **Review the extracted information.** Confirm supplier, amount, recipient, and payment instructions against the source.
3. **Find discrepancies.** Compare the proposed destination with the supplier’s established reference and flag conflicting instructions.
4. **Verify independently.** Assign a changed-payment request to a different authorized team member; the requester cannot approve their own proposal.
5. **Keep the history.** Review the supplier timeline, recorded evidence, decisions, and changes.
6. **Recall what matters.** With separate approval, store minimized guidance in Walrus Memory and retrieve applicable context in later reviews.

An approved supplier reference does **not** authorize a funds transfer. PayGuard supports informed decisions; it does not guarantee fraud prevention or automatically establish supplier identity.

## Features

| Feature | What it does |
| --- | --- |
| **Invoice Inbox** | PDF, PNG, JPEG, WebP, text, and CSV intake, with PDF extraction, local English OCR, editable fields, and duplicate checks |
| **Email forwarding** | Workspace-specific Resend addresses deliver inbound invoices to private source review |
| **Supplier Change Timeline** | Shows actual recipient changes, proposals, independent decisions, and auditable evidence |
| **Two-Person Verification** | Separates requesters from verifiers using distinct signed-in identities, membership controls, and approval invalidation |
| **Walrus Memory** | Retains consented, minimized policy context with provenance, scope, and supersession handling |
| **Optional analysis payment** | Self-service Sui/x402 checkout checks wallet readiness before quoting; delayed confirmations resume automatically, with Tatum verification and saved reports |

Private invoice attachments can be retained in **Private Vercel Blob**; invoice records and audit trails live in **Neon Postgres**. Original invoice documents are **not automatically written to Walrus**. Extracted values require human source review, and forwarded email never establishes a trusted payment recipient by itself.

## Verified evidence

| Area | Verified result |
| --- | --- |
| **Live email intake** | One genuine external synthetic invoice processed in Production; signed webhook, private PDF retention, extraction, and administrator review confirmed |
| **Invoice access** | Unauthorized and cross-workspace document access rejected; duplicate handling covered by integration tests |
| **Walrus Mainnet** | **50 provider-verified blobs / 50 confirmed application memories**, including 16 newly approved synthetic learning records |
| **Sui Mainnet payments** | Three original controlled settlements plus one customer-wallet **terminal SDK** purchase, with independently verified merchant credit and saved reports |
| **Tatum / x402** | Confirmed **0.001 SUI** merchant credit for the terminal purchase; its receipt and report reopened without another charge |
| **Customer checkout and delivery** | The original pending browser purchase was reconciled through its existing digest; report and receipt delivered without resubmission or another charge. Scheduled receipt-only checks are active | 
| **Tests** | **337 unit/integration passes**; **64 browser passes** with two deliberate live-provider skips; separate 32-case focused and mobile runs passed |

[Walrus evidence](docs/BUSINESS_MEMORY_BATCH.md) · [Mainnet settlement evidence](docs/MAINNET_PROOF.md) · [Email acceptance](docs/LIVE_EMAIL_ACCEPTANCE_2026-11-08.md) · [Self-service checkout](docs/CUSTOMER_CHECKOUT_2026-11-09.md) · [Test results](docs/TEST_RESULTS.md)

**Wallet acceptance distinction:** The terminal SDK settlement is independently verified. The owner reports that Nightly extension signing worked in a different browser, but the project’s documented physical Nightly acceptance remains **unverified** until that browser transaction, merchant credit, and report are matched to provider evidence. Connection-only account matching is not payment proof.

The original public [Memory Courtroom](https://payguard-ai-henna.vercel.app/courtroom) is a dated comparison, not a claim of continuous anonymous live recall. Memory evaluations use authored synthetic scenarios, not a measured real-world fraud-detection rate.

## Try PayGuard

The [interactive walkthrough](https://payguard-ai-henna.vercel.app/try), [Memory Courtroom](https://payguard-ai-henna.vercel.app/courtroom), and [public proof](https://payguard-ai-henna.vercel.app/proof) work without a wallet or payment.

For private workspaces, [sign in](https://payguard-ai-henna.vercel.app/connect) and open **Invoice Inbox**, **Vendor Trust**, or **Team Verification**. Team members authenticate separately. Supplier verification does not require purchasing a report. An optional analysis purchase uses a wallet-ready checkout, then returns the verified report in saved history without requiring a transaction digest or developer assistance.

## Stack

**Next.js · TypeScript · Neon Postgres · Drizzle · PDF parsing / Sharp / Tesseract.js · Resend · Private Vercel Blob · Sui · x402 · Tatum · Walrus Memory**

The review engine uses deterministic rules; PayGuard does not call an LLM at runtime.

## Run locally

Use Node.js **22.13+** and npm.

```bash
git clone https://github.com/sopskistar/payguard-ai.git
cd payguard-ai
npm ci
npm run dev
```

Open `http://localhost:3000/try`. Private development requires separate local credentials and a non-Production database; see the [integration guide](docs/INTEGRATION_GUIDE.md).

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:intake:package
npm run test:e2e:qa
```

## Security and operational safeguards

PayGuard is designed for verification-sensitive workflows. Extracted invoice details require human review, supplier destination changes remain subject to independent approval, and payment confirmation is reconciled without duplicate charges.

Private documents use restricted storage with scheduled retention cleanup. Walrus Memory preserves consented, minimized verification context, including historical corrections and superseded guidance, with scope and provenance checks.

The application distinguishes verified Mainnet evidence from simulated tests and documents outstanding integration-specific acceptance checks separately.

For implementation details, testing evidence and operational limitations, see the [Architecture](docs/ARCHITECTURE.md), [Test Results](docs/TEST_RESULTS.md) and [Final Handover](docs/FINAL_HANDOVER.md).

## Documentation

[Business workflows](docs/BUSINESS_WORKFLOWS.md) · [Architecture](docs/ARCHITECTURE.md) · [Judge walkthrough](docs/JUDGE_WALKTHROUGH.md) · [Integration guide](docs/INTEGRATION_GUIDE.md) · [Customer checkout](docs/CUSTOMER_CHECKOUT_2026-11-09.md) · [Memory evaluation](docs/MEMORY_EVALUATION.md) · [Tatum proof](docs/TATUM_PROOF.md) · [Final handover](docs/FINAL_HANDOVER.md)

## License

[MIT](LICENSE)
