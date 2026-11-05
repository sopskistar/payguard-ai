# Production recovery plan — awaiting separate approval

This document covers the original four preparations only. The owner authorized deployment of the validated Tatum read correction, a fresh read-only assessment, and preparation of this plan. Enabling recovery, invoking it, changing financial records, releasing reservations, or starting another checkout remains unauthorized. The physical Nightly account MATCH is accepted as already confirmed and was not re-investigated.

## Release and evidence

Deployment SHA, Vercel status and the post-deployment observation time will be recorded in `docs/evidence/tatum-deployment-2026-11-05.json`. The fresh chain/accounting evidence is in `docs/evidence/tatum-deployed-eligibility-2026-11-05.json`. The diagnosis and retained original evidence remain in [TATUM_HISTORY_2026-11-05](TATUM_HISTORY_2026-11-05.md) and [EXPIRED_PAYMENT_RECOVERY](EXPIRED_PAYMENT_RECOVERY.md).

The assessment uses the authorized operator database connection with enforced **READ ONLY, REPEATABLE READ** transactions. That read access does not grant authority to execute recovery as a customer. It never calls a customer endpoint with administrator credentials, creates or changes a session, requests a signature, or invokes the recovery function. The stored original preparation is parsed and its digest recomputed; no new bytes are prepared.

## Exact original records and proposed changes

Customer workspace: authenticated member wallet **`0xdce341eacb826d2a98abb80ed725bf38f0650a630789abb210e9a079c42365fa`**. All three customer rows share the same original workspace reference. Its authenticated wallet, recorded payer, quote payer and immutable prepared sender agree.

Administrator workspace: the original owner workspace, with recorded payer and immutable sender **`0xc0f3fbf8a029fe354571b58d9e079c1aa4e9ca111a2b025dca470d4bc96397a8`**. This is distinct from the customer. Administrator authentication is the existing owner session; no customer wallet identity is assigned to it.

| Order | Original intent                        | Owning workspace                         | Reserved       | Conditional result                                                                                          |
| ----- | -------------------------------------- | ---------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| 1     | `544d939d-02d5-4d98-b549-69fb9fb501e8` | Customer / member, payer `…c42365fa`     | 1,000,000 MIST | `approved → expired-unexecuted`; wallet and public sponsor ledger each −1,000,000 MIST                      |
| 2     | `7a025238-06d9-43ca-8b5f-16ef7079f086` | Same customer / member                   | 1,000,000 MIST | Same conditional transition and ledger reductions                                                           |
| 3     | `d23937ed-1907-4e40-8156-488f453a921a` | Same customer / member                   | 1,000,000 MIST | Same conditional transition and ledger reductions                                                           |
| 4     | `b0386342-a7c2-40ba-909e-9edf17501767` | Administrator / owner, payer `…c96397a8` | 1,000,000 MIST | `approved → expired-unexecuted`; original owner-session ledger −1,000,000 MIST; no public sponsor reduction |

All four immutable validity windows are **1300–1301 inclusive** on canonical Sui Mainnet. Exact digests, payer bindings, row fingerprints, provider histories, ledger totals and observed eligibility appear in the fresh report. The expected terminal state is conditional on every intent independently requalifying at execution time. None is changed by this plan.

## Authentication and current access limitations

The existing route is `POST https://payguard-ai-henna.vercel.app/api/service-payments/<ORIGINAL_ID>/recover-expired` with the strict JSON body **`{"confirmRecovery":true}`**. It requires the authenticated original workspace, same-origin checks, rate limit and feature flag. The server derives the tenant from the session, accepts no tenant override, and locks/checks the original owning user and intent before chain/accounting validation.

For the three customer requests, the customer must use their actual member session on the Production origin. The browser supplies its own HttpOnly session cookie and Origin header. The administrator must use the original administrator session for the fourth request. Do not copy or manufacture cookies, reassign a session, invoke `recoverExpiredService(customerTenantId, ...)` directly, or access a customer endpoint using administrator credentials.

After separate recovery approval, the legitimate signed-in workspace can send one same-origin request at a time with `credentials: 'same-origin'`, method `POST`, `Content-Type: application/json`, and the exact confirmation body above. Inspect its JSON result and the read-only audit/accounting result before the next ID. This is a planned request; none has been sent.

**The agent currently has no connected customer browser session and no authenticated Vercel management credential/connector.** Therefore it cannot execute customer-owned requests or independently read/set the exact Production recovery environment value under current access. These are operational blockers, not authority to bypass the route. The customer must perform their separately approved requests in their own session, or provide a legitimate controlled browser connection; an authorized Vercel operator must verify and manage the future flag window. No secret value or seed is requested.

The code enables recovery only when `SERVICE_EXPIRED_RECOVERY_ENABLED` is exactly the string `true`; absent/other values disable it. The public release endpoint and current administrator metadata do not expose that runtime value. **The exact deployed flag value is unverified due to missing management read access.** No recovery endpoint may be used as a diagnostic probe, and no environment variable is changed in this task. Before any recovery approval is acted on, verify the Production-scoped value, the environment attached to the live deployment and the release SHA through authorized Vercel access. Historical/default-off behavior is not a substitute for that verification.

## Proposed operation after separate approval

1. Verify the deployed correction SHA, the exact Production flag state, legitimate workspace sessions, unchanged originals, complete liabilities, three preserved settled receipts/reports, confirmed memories and Harborline records. Keep checkout stopped.
2. An authorized Vercel operator opens the narrowly approved recovery window by setting only `SERVICE_EXPIRED_RECOVERY_ENABLED=true` and deploying it. No spending cap, payer, recipient, quote mode, financial setting or other secret changes. This flag change and deployment are future actions, not part of the code-only deployment approval.
3. In the customer session, make requests for the first three exact IDs above, sequentially. In the administrator session, make the request for the fourth. Never run a cross-workspace request. Stop if a session is inaccessible, a request is uncertain, or any provider, protocol, identity, history or liability check fails.
4. Each procedure reads both independent providers afresh. Require canonical Mainnet genesis, compatible reviewed protocol/feature flags, epoch strictly after maximum validity, explicit original-digest lookups, full before/after history coverage, and matching canonical closed-epoch checkpoint evidence. Evidence must be fresh within the existing 60-second limit. A transaction found after an initial `NOT_FOUND` remains blocking. A success in this report is not a reusable authorization token.
5. Verify each response and persisted audit/ledger change read-only before continuing. All original fields other than the audited terminal state remain preserved. The existing operation is atomic per intent, not one atomic transaction across all four IDs.
6. Close the window: the authorized Vercel operator restores `SERVICE_EXPIRED_RECOVERY_ENABLED=false`, deploys and verifies the live disabled state and SHA. Recheck complete liabilities and protected fingerprints. Stop before any new checkout.

## Exact expected accounting and audit

- Customer wallet historical reservation: **3,000,000 → 2,000,000 → 1,000,000 → 0 MIST** (0.003 SUI released from the accounting hold).
- Public sponsor ledger: the same **3,000,000 → 2,000,000 → 1,000,000 → 0 MIST**, one mirrored reduction per customer intent. This is not an additional onchain refund or transfer.
- Original administrator session reservation: **1,000,000 → 0 MIST** (0.001 SUI), with no sponsor-ledger change for that intent.
- Settled and failed liabilities in all other sessions remain counted. A total mismatch blocks recovery rather than allowing a manual adjustment.
- Each successful original ID remains present in `expired-unexecuted`, with one atomic `service.expiry_recovered` audit: prior/new state, original digest and validity, independently collected provider reads/lookups and retry history, boundary/floor/tip proof, reviewed rules, retained wallet-event summary, `releasedAtomic:"1000000"`, and correct public-release indicator. `signaturesMayHaveExisted:true` and `paymentFailureAsserted:false` avoid fabricating certainty about the earlier wallet attempt.
- An intact repeat returns `alreadyRecovered:true` and releases **0**. A held review leaves the intent/reservation intact and records `service.expiry_recovery_held` with a reason, evidence and zero release.
- Exactly three existing settled payments, receipts and reports remain unchanged; all confirmed Walrus job/blob/namespace bindings and Harborline business records remain unchanged. No new receipt, fabricated financial signature, blockchain transaction, quote, transaction preparation, report purchase or Walrus write occurs.

## Interrupted operation and incident response

1. **Stop:** no next intent, replacement quote, payment or automatic request replay. Record the original ID, request time and safe HTTP/JSON result without cookies, credentials, prepared bytes or signatures. A timeout or lost response establishes neither success nor rollback.
2. **Contain:** the authorized Vercel operator disables recovery, redeploys and verifies the live runtime flag and SHA. If management access is unavailable, report it, keep all requests stopped and require the authorized operator; do not pretend that the flag was changed.
3. **Reconcile read-only:** inspect that ID's state, original preparation fingerprint, `service.expiry_recovered`/held audits and complete wallet/public liabilities. Reconcile all already attempted IDs as well as the remaining ones. Per-intent transactions commit the state, both applicable ledger updates and successful audit together. A disconnected request can still finish on the server.
4. **Classify:** if it committed coherently, retain the terminal state and exact reductions. If the transaction aborted, its financial updates and recovery audit roll back together; leave the original approved hold. A held result has no release. If any state/audit/ledger combination is inconsistent, stop all recovery and checkout and preserve the discrepancy for investigation.
5. **Resume only with authority:** after coherence, fresh qualification and confirmed runtime/session access, obtain renewed approval if the original approval/window no longer clearly covers continuation. The same owning workspace may then repeat the exact original ID; an intact completed recovery returns zero additional release. Never add/subtract reservations directly to compensate for a timeout.
6. **Code rollback:** if needed and authorized, restore the prior application source (`69425c577c629cc9d740def313c73c522ed022c3`) through an ordinary revert/redeployment after containment. Verify environment and live SHA separately; rolling back code is not proof that a runtime flag is off. Keep all committed financial states, receipts, reports, memories and audit entries. Never roll back the database, delete audit evidence, or directly reverse a completed recovery.

The principal remaining risks are shared-key rate limiting across server instances, advancing retention floors, provider inconsistency, protocol changes, a newly discovered execution, session/flag access, and a partially completed four-intent sequence. The fixed independent evidence checks, bounded retry, freshness limit, atomic accounting, idempotence and stop rules address these risks by retaining holds whenever evidence is uncertain. They do not constitute a cryptographic non-inclusion proof.

**Stop point: no feature flag enabled, no recovery invoked, no financial record or reservation modified, and no final 0.001 SUI Nightly checkout.**
