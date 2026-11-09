# PayGuard Verify

**Verify before you pay. Remember what nearly went wrong.**

PayGuard Verify helps a business compare supplier payment instructions with its established records, keep changed destinations on hold, and record an independent human check. Approved, minimized policies can be recalled through Walrus Memory during later reviews.

[Live app](https://payguard-ai-henna.vercel.app/) · [Approved demo](https://youtu.be/i2ZsEPIegy4) · [Interactive walkthrough](https://payguard-ai-henna.vercel.app/try) · [Memory Courtroom](https://payguard-ai-henna.vercel.app/courtroom) · [Mainnet proof](https://payguard-ai-henna.vercel.app/proof) · [Technical article](https://sopskistar.github.io/payguard-ai/)

[![Watch the approved 2:46 PayGuard Verify demonstration](public/demo-approved-poster.png)](https://youtu.be/i2ZsEPIegy4)

The approved video shows the earlier submitted version. The business intake, timeline and maker-checker features described below are subsequent additions.

## The problem

An invoice looks familiar, but the bank account or payment address has changed. A convincing email, a valid address and a familiar supplier name do not establish who controls the destination.

PayGuard makes the difference visible and retains the human verification requirement. It supports a careful review; it does not guarantee fraud prevention or authenticate a supplier automatically.

## How it works

1. Upload or forward an invoice, or enter its details. Review extracted fields against the source.
2. Compare the proposed destination with the supplier’s established reference.
3. Inspect changed recipients, conflicting instructions, payment links and embedded bypass requests.
4. In a business workspace, submit a verification request to a different authorized identity.
5. Record the independently obtained evidence and decision in the supplier timeline.
6. Propose a minimized policy for separate, consent-based Walrus learning.
7. On a later review, distinguish retrieved memory from context that actually influenced the result.

## Invoice intake and forwarding

Invoice Inbox accepts **PDF, PNG, JPEG, WebP, UTF-8 text and single-row CSV**. Text PDFs use deterministic extraction. Images and scanned PDFs use a bundled English OCR engine; the document is not sent to an external OCR or LLM service.

Extracted fields remain suggestions. Missing and conflicting values require review, supplier-name matches do not establish trust, and a document never creates a trusted destination automatically. Source previews are rendered pixels, and embedded links are displayed without being opened.

Uploads are limited to **3 MB**, with at most **15 PDF pages** or **3 scanned pages**. Raw originals are processed ephemerally by default. Optional retained attachments use private Vercel Blob storage behind tenant-authorized routes.

Production has processed a **genuine external synthetic invoice email** through Resend at `invoices.flownix.xyz`: signed delivery, administrator-workspace routing, private PDF retention and extracted fields are confirmed. The document remains a review draft; no supplier destination was trusted automatically. Anonymous and other-workspace document access are denied. **EMAIL FORWARDING: VERIFIED.** Completed-message idempotency is covered by isolated integration tests. [Live evidence and acceptance scope](docs/LIVE_EMAIL_ACCEPTANCE_2026-11-08.md).

Other deployments require owner-configured receiving credentials, webhook and private storage. Intake stays disabled when required configuration is missing. Workspace members never supply provider keys. [Intake and setup boundaries](docs/BUSINESS_WORKFLOWS.md).

## Supplier Change Timeline

Vendor Trust and Team Verification show a chronological supplier history: invoice arrivals and edits, recipient changes, proposals, decisions, invalidations and learning events.

Database audit records and Walrus confirmation evidence are labeled separately. Memory entries include retained job/blob/namespace references, applicability and actual retrieval/application timestamps where recorded. Missing historical actors or evidence are shown as unknown rather than reconstructed.

## Two-Person Verification

A business administrator explicitly adds existing, wallet-authenticated identities as **requester**, **verifier** or **organization administrator**. Members share authorized business records; personal service-payment workspaces and payer permissions remain separate.

A requester cannot approve the same proposal, even after changing roles. The server checks current membership, serializes approval and revocation, binds the decision to the exact invoice instructions and supplier revision, and invalidates it after material changes. Legacy mutation routes retain these business safeguards.

An approved supplier change **does not authorize a blockchain payment**. A human attestation records what the verifier asserts; PayGuard does not observe a callback or guarantee that two wallets represent two different people. [Workflow and security design](docs/BUSINESS_WORKFLOWS.md).

## Walrus Memory

The November 5 verification confirms **50 distinct Walrus Mainnet blobs and 50 confirmed application memory records**, with no pending or failed jobs. The exact owner-approved 16-record synthetic batch completed through the existing sponsored integration; the older provider-completed customer row was reconciled through its legitimate owning workspace without another write. All original 33 confirmed references remain preserved. [Per-record job/blob and retrieval evidence](docs/evidence/approved-business-memory-verified-1793916025290.json).

Every new record was retrieved with matching decrypted text in a fresh verification process. All **16 expanded policy contracts** and the existing **18/18 live-recall contracts** passed, retaining baseline holds and excluding stale or wrong-scope guidance. These are authored contract evaluations, not real-world fraud-detection accuracy scores. Retained history includes superseded and expired guidance; 50 memories does not mean 50 simultaneously applicable rules. [Approved batch](docs/BUSINESS_MEMORY_BATCH.md) · [methodology](docs/MEMORY_EVALUATION.md).

An explicit human correction can stay private or, with separate consent, become minimized Walrus guidance for later recall. Corrections preserve provenance and the human verification hold. The public Courtroom remains a dated, captured comparison.

## Tatum and x402 evidence

The three original developer-controlled Sui Mainnet purchases each credited the merchant **0.001 SUI**, with their reports and receipts preserved. A later dedicated customer-wallet **terminal SDK acceptance also finalized**, with Tatum-confirmed 1,000,000 MIST merchant credit and a saved report reopened without another charge. Tatum provides independent native Sui gRPC verification. [Settlement evidence and current reconciliation](docs/MAINNET_PROOF.md) · [Tatum verification](docs/TATUM_PROOF.md).

[Transaction 1](https://suivision.xyz/txblock/68bhHRKzrQang8xohsahBQbehoZ4SjApQJ1U1Wf2ppyx) · [Transaction 2](https://suivision.xyz/txblock/xASYnWVeftLraQ2RvxMR6oPndU3r7UoBrX9Z9KPJd9r) · [Transaction 3](https://suivision.xyz/txblock/4NxNL1sekFUNxpiu6ebhTtwdkT5UXnsiMsnhcPNK1tGA)

These are controlled experiments using synthetic invoices. **Physical Nightly customer financial-signing acceptance remains unverified.** The successful terminal SDK test does not establish which browser extension approved an existing wallet transaction. A connection-only account match is not a finalized payment. Supplier invoice verification and the optional first-party analysis purchase have separate authorization and accounting. [Payment boundaries](docs/AGENT_PAYMENTS.md).

## Try the product

No wallet, payment or account is needed for the [public walkthrough](https://payguard-ai-henna.vercel.app/try), [Memory Courtroom](https://payguard-ai-henna.vercel.app/courtroom) or [recorded proof](https://payguard-ai-henna.vercel.app/proof).

For private records, [sign in](https://payguard-ai-henna.vercel.app/connect) with a supported wallet’s free personal-message signature. Use **Invoice Inbox** for intake, **Vendor Trust** for established references and history, and **Team Verification** for shared maker-checker review. Every teammate signs in independently. No financial purchase is required to test business verification.

## Architecture

```mermaid
flowchart LR
  Source[Upload or verified email intake] --> Review[Human extraction review]
  Review --> Inbox[Existing invoice and supplier records]
  Inbox --> Request[Identity-bound proposal]
  Request --> Check[Different authorized verifier]
  Check --> History[Decision and supplier timeline]
  History --> Consent[Separate minimized-memory approval]
  Consent --> Walrus[Walrus job and blob confirmation]
  Walrus --> Recall[Later scoped recall]
  Recall --> Inbox
```

| Technology                                       | Role                                                                               |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Next.js, TypeScript, Neon and Drizzle            | Application, tenant-scoped records, transactions and audit history                 |
| PDF.js through pdf-parse, Sharp and Tesseract.js | Bounded document parsing, safe pixel previews and local English OCR                |
| Private Vercel Blob and Resend                   | Optional retained originals and signed inbound-email intake                        |
| Wallet Standard and Sui                          | Personal-message authentication and separately approved service-payment signatures |
| Walrus Memory                                    | Consented policy persistence, confirmed provenance and scoped recall               |
| Tatum and x402                                   | Independent transaction verification and optional paid analysis                    |

The review engine is deterministic. The application does not call an LLM at runtime. [Architecture](docs/ARCHITECTURE.md) · [integration guide](docs/INTEGRATION_GUIDE.md).

## Run locally

Use Node.js **22.13 or later** and npm.

```bash
git clone https://github.com/sopskistar/payguard-ai.git
cd payguard-ai
npm ci
npm run dev
```

Open `http://localhost:3000/try` for the public synthetic demo. For private development, configure a new database and local environment using the [setup guide](docs/INTEGRATION_GUIDE.md). Never seed or reset Production for testing.

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:intake:package
npm run test:e2e:qa
```

The QA runner creates a disposable local database and disables live payment, memory, storage and email credentials. Tests cover document extraction, tenant isolation, maker-checker identity and concurrency, provenance, wallet adapter/payer binding and settlement integrity. Physical wallet acceptance and real provider configuration are reported separately. [Current results](docs/TEST_RESULTS.md).

Final validation: **328/328 unit/integration passes** and a fresh complete browser run with **62 passes, two intentional live-provider skips, zero failures or flakes**. The earlier focused browser run passed **31/31** separately. TypeScript, lint, formatting, production build and packaged PDF/OCR checks pass. Real email/storage evidence is recorded separately from provider fixtures. [Current test results](docs/TEST_RESULTS.md).

OCR can misread payment details; human source review remains mandatory. No antivirus service is claimed. Private attachment retention and live email require owner setup. Increasing the memory count does not establish better fraud detection.

## Documentation

- [Business workflow and security](docs/BUSINESS_WORKFLOWS.md)
- [Judge walkthrough](docs/JUDGE_WALKTHROUGH.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Integration guide](docs/INTEGRATION_GUIDE.md)
- [Memory evaluation](docs/MEMORY_EVALUATION.md)
- [Mainnet proof](docs/MAINNET_PROOF.md)
- [Testing](docs/TEST_RESULTS.md)
- [Final handover](docs/FINAL_HANDOVER.md)
- [Wallet security](docs/WALLET_SECURITY.md)

## License

[MIT](LICENSE).
