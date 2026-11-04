# Connection checks and expired prepared-payment recovery

The Signing wallet selector and **Check selected wallet account · no signing** now live in the signed-in **Checkout account** panel on `/services`, above purchase controls. Neither requires a quote or financial preparation permission. Wallet discovery also runs independently of those permissions. The same Sui-filtered provider selection and exact account checks are reused; the diagnostic never requests terms, prepares bytes, signs, submits or changes reservations. Account/provider events update MATCH, MISMATCH, DISCONNECTED or UNAVAILABLE. Wallet Standard advertises supported account chains; the owner must also confirm the selected network in Nightly itself. A connection match does not certify financial signing acceptance.

## Recovery is explicit and disabled by default

`POST /api/service-payments/:id/recover-expired` requires the existing authenticated private workspace, same-origin checks, rate limit, strict `{ "confirmRecovery": true }` body and ownership of the intent. `SERVICE_EXPIRED_RECOVERY_ENABLED` must also be exactly `true`. This flag defaults off and is not a safety override: owners and customers pass the same chain and accounting checks. This task does not enable or invoke recovery in Production. Connection checks, quote, resume, cancellation and scheduled work never call this procedure.

No database migration, historical rewrite, wallet signature or onchain transaction is needed for this implementation. Testing uses newly created disposable PGlite data and synthetic provider responses. Enabling or exercising Production recovery requires separate owner approval.

## Reviewed chain rules

On November 4, 2026, independent reads observed Mainnet protocol **139** on Tatum (`sui-node/1.82.4-485613f749ed`) and the public full node (`sui-node/1.83.1-6a567faf6de1`). Both enabled address-balance gas and multi-epoch expiration. The [deployed Tatum revision's transaction validity check](https://github.com/MystenLabs/sui/blob/485613f749ed/crates/sui-types/src/transaction.rs) rejects `ValidDuring` transactions when the current epoch is **strictly greater** than `max_epoch`; timestamp-based expiration is unsupported. This is an inclusive maximum epoch, independent of application quote expiration.

Recovery accepts only this application's validated Mainnet transaction template with a bounded `ValidDuring` window, no timestamp fields and an exact recomputed digest. Both providers must still report the reviewed protocol 139 and required feature flags at recovery time. Any protocol upgrade blocks recovery pending another source review; no environment variable can override the version check. Other expiration variants and wider windows remain held.

## Conditions for releasing one reservation

All conditions are required, inside the authenticated recovery operation:

1. Lock the owning user and original intent. The intent must remain `approved`, with immutable prepared bytes, payer and reservation. Validate its original terms and recompute its exact digest. Customer identity, quote payer, sender and wallet-budget identity must agree.
2. Inspect receipts, signing/provider audit events, stored payload hash, execution digest and submission/confirmation evidence. A receipt, non-approved state or disclosure/submission evidence prevents this release path and requires settlement reconciliation. Wallet request/error/returned-signature events alone neither authorize release nor get erased.
3. Query the exact digest once through fixed, separately operated Tatum and Sui full-node endpoints. Any positive, incomplete, unavailable, contradictory or wrong-network response keeps the hold. A finalized failure also remains reserved under this conservative procedure; it is not reclassified to free quota.
4. Both providers must agree on a current Mainnet epoch strictly after the maximum valid epoch and return explicit `NOT_FOUND`. A single `NOT_FOUND`, quote expiry or elapsed wall-clock time is insufficient.
5. Both must provide matching first/final checkpoints for the entire validity window and the same final checkpoint digest. Read that final checkpoint and verify its epoch and end-of-epoch marker. Both node tips must be past it. Before and after the transaction read, transaction-history retention must cover the first valid checkpoint. Missing/pruned history, a moving-backward ledger view, an unclosed boundary, stale evidence or changed protocol keeps the hold.
6. Lock the public sponsor ledger, then the original wallet/session budget in the same order as approval. Require exact agreement between each reserved total and all counted intent liabilities. Settled and failed payments continue to count; release only the original intent's exact amount, once, from the applicable wallet and public ledgers. Any accounting inconsistency blocks the operation.

The negative conclusion relies on the documented transaction-retention contract of both independent RPC services, after finalized epoch closure. It is not a cryptographic non-inclusion proof. Suspected provider inconsistency or incomplete coverage must stay held for further archival reconciliation, never an administrator force-release.

## State transition and audit

Only a fully satisfied review changes `approved` to **`expired-unexecuted`**. It does not assert that a signature never existed, or call the payment failed. Original bytes, prepared digest, approval, timestamps and wallet/provider events remain intact. No receipt is fabricated.

The atomic `service.expiry_recovered` audit includes the prior/new states, exact digest/window, both provider observations, reviewed rules, retained wallet-event summary and exact released amount. Unsuccessful reviews record `service.expiry_recovery_held` with a reason and zero release. The original payload and signatures are never copied into diagnostics.

Row locks serialize recovery against approval and submission; shared budget locks protect competing customers. A repeat of a completed recovery returns zero additional release and performs no new chain reads. A recovered record cannot be resubmitted, cancelled to free quota again, or reused as a new operation. Its original operation key remains consumed. Other unresolved holds still block new checkout. Unique receipt/digest constraints remain unchanged.

## Owner acceptance remains separate

Epoch 1302 or later is necessary for the four historical 1300–1301 preparations, but not sufficient to free them. Recheck exact provider and accounting evidence, review the recovery audit, and obtain approval before any real recovery operation. Do not edit intent states, erase local wallet-attempt markers, decrement reservations directly or sign old expired quotes.

Only after all applicable holds are safely resolved may the owner request one fresh 0.001 SUI quote for the existing Harborline invoice, verify payer/merchant/Mainnet/sponsor/expiry, prepare once, inspect frozen bytes/digest and personally approve Nightly once. A provider error or uncertain signature outcome stops the attempt. Financial acceptance requires independent finalized exact merchant credit, the persisted report and receipt, and reopening that report without a second payment. This implementation does not claim physical Nightly financial acceptance.

## Validation

- All **239 unit/integration tests in 35 files passed**, including the disposable recovery database and independent-provider contract tests.
- The complete disposable-database browser suite passed **50 cases**, with **two intentional live-provider skips**, zero failures and zero flakes. It exercises a no-quote check with financial permissions disabled and a recovery hold active, shared-ID Sui adapter selection, account/network changes, disconnection, unsupported signing capabilities and recovery API authorization/default-off guards. [Actual browser results](evidence/nightly-diagnostic-recovery-browser.json).
- Production build, sequential TypeScript and targeted formatting passed. Lint has zero errors and one pre-existing warning in untouched video capture tooling.
- The initial restricted build could not parse its TypeScript subprocess output; the unrestricted build passed. The first browser setup found an unrelated listener on port 3005 and ran no tests. The successful complete run used a fresh database and port 3047, preserving both the listener and initial setup logs.
- A live read-only probe observed protocol 139 and epoch 1301. A Tatum read interruption produced `PROVIDER_UNAVAILABLE`, retaining the hold. No recovery operation, financial signature, submission or memory write was performed against Production.
