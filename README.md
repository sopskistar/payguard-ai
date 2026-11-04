# PayGuard Verify

**Verify before you pay. Remember what nearly went wrong.**

PayGuard Verify helps teams identify suspicious supplier payment-instruction changes, preserve mandatory human verification, and recall trusted decisions through Walrus Memory. It makes changed payment destinations visible before someone approves an invoice.

[Live App](https://payguard-ai-henna.vercel.app/) · [Watch Demo](https://youtu.be/i2ZsEPIegy4) · [Try Interactive Demo](https://payguard-ai-henna.vercel.app/try) · [Memory Courtroom](https://payguard-ai-henna.vercel.app/courtroom) · [Mainnet Proof](https://payguard-ai-henna.vercel.app/proof) · [Technical Write-up](https://sopskistar.github.io/payguard-ai/)

[![Watch the 2:46 PayGuard Verify official demo on YouTube](public/demo-approved-poster.png)](https://youtu.be/i2ZsEPIegy4)

## The problem

A familiar supplier sends an invoice with updated payment details. The amount and business name may be unchanged, but the destination is different.

PayGuard compares that destination with the established record and keeps approval on hold until the change is independently verified. It supports a careful review; it does not guarantee fraud prevention.

## How it works

1. Capture an invoice through a form or supported file import.
2. Compare proposed and established payment instructions.
3. Flag suspicious changes and instructions embedded in invoice text.
4. Keep human verification mandatory for a changed recipient.
5. Record an authorized decision and its audit evidence.
6. With consent, preserve minimized policy context in Walrus and recall relevant trusted decisions later.
7. Review findings, citations and decision history together.

## Features

- Supplier recipient comparison, suspicious-instruction detection and human verification holds.
- Invoice ingestion, review and audit history in isolated private wallet workspaces.
- Walrus-backed persistent memory with provenance and tenant ownership checks.
- Memory OFF/ON comparisons and an interactive Memory Courtroom.
- Tatum Sui transaction inspection against explicit recipient and payment terms.
- x402 payment-backed analysis with onchain receipts and reopenable delivered reports.

## Verified evidence

### Walrus Memory

The **November 3, 2026** read-only recovery confirmed **33 Mainnet records**: the original 32 plus one member correction. Completed job, blob and namespace references were rechecked; all original records were preserved. Recall checks bind memory to the authenticated tenant and exact stored evidence. [Provider check](docs/evidence/recovered-walrus-provider-check.json) · [preservation check](docs/evidence/nightly-account-preservation.json).

The public Courtroom presents a **November 1 recorded comparison**, not a fresh anonymous recall. Historical Experiment 3 returned **OFF: 0 / ON: 7 citations**, with mandatory safety holds retained. A separate evaluation passed **18/18 authored synthetic learning contracts**; this is not a real-world fraud-detection accuracy score. [Memory evidence](docs/MEMORY_EVALUATION.md) · [evaluation results](docs/evidence/learning-report.json).

### Tatum and Sui

Three real Sui Mainnet x402 settlements each credited the merchant **0.001 SUI**: **0.003 SUI total**, with three persisted analysis reports. November 3 reads independently reconfirmed execution through Tatum Sui gRPC and a Sui fullnode. Saved reports reopened without another charge. [Full evidence and receipts](docs/MAINNET_PROOF.md).

[Transaction 1](https://suivision.xyz/txblock/68bhHRKzrQang8xohsahBQbehoZ4SjApQJ1U1Wf2ppyx) · [Transaction 2](https://suivision.xyz/txblock/xASYnWVeftLraQ2RvxMR6oPndU3r7UoBrX9Z9KPJd9r) · [Transaction 3](https://suivision.xyz/txblock/4NxNL1sekFUNxpiu6ebhTtwdkT5UXnsiMsnhcPNK1tGA)

These are **developer-controlled Mainnet experiments using synthetic invoices**, not independent customer adoption or payments to suppliers.

**Customer checkout limitation:** physical Nightly production financial-signing acceptance is not independently verified. Historical ambiguous intents remain subject to reconciliation safeguards; an expired quote alone does not establish that another signature is safe. [Current status and recovery boundaries](docs/NIGHTLY_ACCOUNT_SELECTION_2026-11-03.md).

## Technology

| Technology             | Role                                                                            |
| ---------------------- | ------------------------------------------------------------------------------- |
| Walrus Memory          | Persistent approved policy context, memory jobs, recall and provenance.         |
| Tatum                  | Native Sui gRPC transaction inspection and independent settlement verification. |
| Sui                    | Mainnet transaction execution and service-payment settlement.                   |
| x402                   | Payment-required quotes and paid analysis delivery after verified settlement.   |
| Neon PostgreSQL        | Durable invoices, tenant-scoped records, decisions and audit history.           |
| Next.js and TypeScript | Application interface, server routes and deterministic review engine.           |
| Wallet Standard        | Wallet authentication and explicitly authorized financial signatures.           |

The review engine and paid report are **deterministic**. The application does not call an LLM at runtime.

## Try PayGuard in under one minute

**No wallet, payment or account required:**

1. Open the [public demo](https://payguard-ai-henna.vercel.app/try) and review the synthetic suspicious invoice.
2. Compare established and proposed recipients, then inspect the human verification hold.
3. Open the [Memory Courtroom](https://payguard-ai-henna.vercel.app/courtroom), compare OFF/ON and expand the recorded citations.
4. Inspect the [Mainnet proof](https://payguard-ai-henna.vercel.app/proof) and transaction receipts.

For a private workspace, [sign in with a supported wallet](https://payguard-ai-henna.vercel.app/connect) using a free personal-message signature, create your own synthetic supplier and invoice, and review its instructions. Connection and authentication do not authorize a financial payment. Judges do not need to fund a wallet or buy analysis.

## Architecture

**Review:** Invoice → Verification engine → Human decision → Consented Walrus memory → Later scoped recall.

**Paid analysis:** x402 quote → Explicit wallet approval → Sui settlement → Tatum verification → Delivered analysis.

The paid path has three historical Mainnet validations; physical Nightly customer financial acceptance remains limited as disclosed above. Supplier payments are outside this application's signing flow. [Architecture](docs/ARCHITECTURE.md) · [payment protocol](docs/AGENT_PAYMENTS.md).

## Run locally

Use Node.js **22.13 or later** and npm.

```bash
git clone https://github.com/sopskistar/payguard-ai.git
cd payguard-ai
npm ci
npm run dev
```

Open `http://localhost:3000/try` for the public synthetic demo. It needs no provider credentials. Private persistence and live integrations require your own environment configuration; see the [setup guide](docs/INTEGRATION_GUIDE.md). Do not seed, reset or reuse the production database for local setup.

## Testing and evidence

The **November 3 recovery** recorded **224 unit/integration passes**, **47 local browser passes** and two deliberate live-provider skips. Production checks covered **19 API assertions across eight public routes**; an earlier November 3 run recorded **14 public browser passes**. TypeScript, lint (one existing video-tool warning), formatting and production build passed. These are dated results, separate from physical wallet acceptance. [Validation record](docs/evidence/nightly-account-validation.json) · [test ledger and presentation-release checks](docs/TEST_RESULTS.md).

## Documentation

- [Judge Walkthrough](docs/JUDGE_WALKTHROUGH.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Walrus Memory Evidence](docs/MEMORY_EVALUATION.md)
- [Tatum and Mainnet Proof](docs/MAINNET_PROOF.md)
- [Payment Protocol](docs/AGENT_PAYMENTS.md)
- [Testing](docs/TEST_RESULTS.md)
- [Security and Limitations](docs/WALLET_SECURITY.md)
- [Published Write-up](https://sopskistar.github.io/payguard-ai/)

## License

[MIT](LICENSE).
