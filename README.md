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
| **Optional analysis payment** | Uses x402/Sui for a separate first-party report, with Tatum verification and a saved receipt |

Private invoice attachments can be retained in **Private Vercel Blob**; invoice records and audit trails live in **Neon Postgres**. Original invoice documents are **not automatically written to Walrus**. Extracted values require human source review, and forwarded email never establishes a trusted payment recipient by itself.

## Verified evidence

| Area | Verified result |
| --- | --- |
| **Live email intake** | One genuine external synthetic invoice processed in Production; signed webhook, private PDF retention, extraction, and administrator review confirmed |
| **Invoice access** | Unauthorized and cross-workspace document access rejected; duplicate handling covered by integration tests |
| **Walrus Mainnet** | **50 provider-verified blobs / 50 confirmed application memories**, including 16 newly approved synthetic learning records |
| **Sui Mainnet payments** | Three original controlled settlements plus one customer-wallet **terminal SDK** purchase, with independently verified merchant credit and saved reports |
| **Tatum / x402** | Confirmed **0.001 SUI** merchant credit for the terminal purchase; its receipt and report reopened without another charge |
| **Tests** | **328 unit/integration passes**; **62 browser passes** with two deliberately skipped live-provider cases; build, typecheck, and packaging checks passed |

[Walrus evidence](docs/BUSINESS_MEMORY_BATCH.md) · [Mainnet settlement evidence](docs/MAINNET_PROOF.md) · [Email acceptance](docs/LIVE_EMAIL_ACCEPTANCE_2026-11-08.md) · [Test results](docs/TEST_RESULTS.md)

**Wallet acceptance distinction:** The terminal SDK settlement is independently verified. The owner reports that Nightly extension signing worked in a different browser, but the project’s documented physical Nightly acceptance remains **unverified** until that browser transaction, merchant credit, and report are matched to provider evidence. Connection-only account matching is not payment proof.

The original public [Memory Courtroom](https://payguard-ai-henna.vercel.app/courtroom) is a dated comparison, not a claim of continuous anonymous live recall. Memory evaluations use authored synthetic scenarios, not a measured real-world fraud-detection rate.

## Try PayGuard

The [interactive walkthrough](https://payguard-ai-henna.vercel.app/try), [Memory Courtroom](https://payguard-ai-henna.vercel.app/courtroom), and [public proof](https://payguard-ai-henna.vercel.app/proof) work without a wallet or payment.

For private workspaces, [sign in](https://payguard-ai-henna.vercel.app/connect) and open **Invoice Inbox**, **Vendor Trust**, or **Team Verification**. Team members authenticate separately. Supplier verification does not require purchasing a report.

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

## Limits and operational notes

- OCR and extracted payment details can be wrong. **Human verification remains mandatory.**
- Two separately authenticated wallets do not, by themselves, prove that two distinct people performed an offline supplier check.
- The separate browser payment documented as `settling` still requires **receipt-only reconciliation** through its legitimate owning session; do not create a replacement charge.
- Private source access expires after seven days; automated physical deletion requires the owner’s cleanup scheduler. No antivirus scanner is claimed.
- The 50 Walrus records include historical/superseded material; the count does not imply 50 currently applicable policies.

## Documentation

[Business workflows](docs/BUSINESS_WORKFLOWS.md) · [Architecture](docs/ARCHITECTURE.md) · [Judge walkthrough](docs/JUDGE_WALKTHROUGH.md) · [Integration guide](docs/INTEGRATION_GUIDE.md) · [Memory evaluation](docs/MEMORY_EVALUATION.md) · [Tatum proof](docs/TATUM_PROOF.md) · [Final handover](docs/FINAL_HANDOVER.md)

## License

[MIT](LICENSE)
