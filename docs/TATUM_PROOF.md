# Independent Tatum verification

PayGuard uses Tatum's native Sui gRPC endpoint, `sui-mainnet-grpc.gateway.tatum.io:443`, with TLS and a server-only API key. Transaction reads use the installed Sui client's ledger-service `getTransaction` method and explicit read masks. The verifier checks canonical Mainnet identity, finalized successful effects, exact payer/recipient/native-SUI terms and integer merchant credit. A provider response, signature or `NOT_FOUND` alone is never settlement proof.

## Verified acceptance evidence

| Flow                               | Finalized digest                               | Checkpoint | Tatum merchant credit | Application delivery                                                                   |
| ---------------------------------- | ---------------------------------------------- | ---------- | --------------------- | -------------------------------------------------------------------------------------- |
| Customer terminal SDK              | `7imzSd3vwTW7x5rdBYYqn7LWn1UAYmjpewT2bF73ZCS`  | 342076083  | 1,000,000 MIST        | Receipt `805af879-4162-4ce2-8cf5-af993c896410`; report reopened without another charge |
| Existing November 8 wallet attempt | `7J34zZ1VnJt6RdvLbJRrnz387bcHrhstvbi3KAhBEcm7` | 343045220  | 1,000,000 MIST        | Receipt `5ebdc0a2-9476-417f-89e0-a75d8bb15cc5` persisted                               |
| Existing November 8 wallet attempt | `2xeyRARY91UvYNFNfL6XiJSTqNXtUW31ezkDADohgP1S` | 343054969  | 1,000,000 MIST        | Chain success verified; owning-customer report reconciliation still pending            |

These provider results were captured independently of this email release. The later read-only preservation check confirms existing application states; it does not initiate a transaction or repeatedly re-query every historical provider result. The November 8 chain evidence includes Sui full-node agreement, matching payer and merchant, and separate sponsor gas of 100,000 MIST. Neither an explorer page nor the browser's prepared digest supplies these claims. [Sanitized captured provider and preservation evidence](evidence/email-closeout-preservation-20261108.json) · [captured terminal acceptance](evidence/terminal-payment-final-acceptance-1793921119194.json) · [captured read-only provider results](evidence/browser-payment-readonly-20261108-1794157415592.json).

The original three experiment transactions, effects and delivery evidence remain in [Mainnet Proof](MAINNET_PROOF.md). The successful terminal SDK test does **not** certify Nightly's browser adapter. Physical Nightly acceptance remains unverified without a separately identified genuine popup approval and complete report/receipt delivery.

## Failure and reconciliation boundaries

The historical Tatum `UNAVAILABLE` incident was traced to HTTP 429 quota limiting, not assumed pruning. Shared paced reads and one bounded cooldown retry preserve the independent chain/history checks. Recovery remains disabled in Production; this email release changes no provider-verification or accounting rules. See [the historical incident](TATUM_HISTORY_2026-11-05.md) and [guarded recovery contract](EXPIRED_PAYMENT_RECOVERY.md).

Initial transaction-index lag can leave an executed payment's report pending. Reconcile the **same original digest** through the payer's normal authenticated session. Do not create replacement bytes, re-sign, resubmit an uncertain attempt, release its liability or fabricate a receipt. Supplier identity checks, human supplier approval and optional first-party service purchases retain separate authority.
