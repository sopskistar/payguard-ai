# Tatum historical epoch diagnosis and proposed recovery

The reproducible failure is **HTTP 429 rate limiting, surfaced by the gRPC client as `UNAVAILABLE`**. Epoch 1301 and its closing checkpoint are retained and readable at Tatum. At the diagnosis snapshot, the correction was local and tested and Production remained on `69425c577c629cc9d740def313c73c522ed022c3`. The owner subsequently authorized deployment of this correction only; recovery still requires separate approval. No recovery, configuration change, financial record mutation, quote, transaction preparation, signature, submission, or Walrus write was performed during diagnosis.

## Reproduction and exact API contract

The original reader sends `GetServiceInfo`, current `GetEpoch`, and `GetTransaction` without pacing, then starts the two historical `GetEpoch` calls concurrently. Replaying that sequence returned:

| Request                                                                 | gRPC result | Safe detail                       |
| ----------------------------------------------------------------------- | ----------- | --------------------------------- |
| `GetServiceInfo {}`                                                     | OK          | Mainnet identity and retention    |
| `GetEpoch`, current epoch and protocol mask                             | OK          | Epoch 1302, protocol 139          |
| `GetTransaction`, original digest                                       | NOT_FOUND   | No finalized transaction returned |
| `GetEpoch {epoch:1300, read_mask:{paths:["epoch","first_checkpoint"]}}` | UNAVAILABLE | `Received HTTP status code 429`   |
| `GetEpoch {epoch:1301, read_mask:{paths:["epoch","last_checkpoint"]}}`  | UNAVAILABLE | `Received HTTP status code 429`   |

The endpoint is **`sui-mainnet-grpc.gateway.tatum.io:443`**, TLS with the server-only `x-api-key` metadata. Full method names are `/sui.rpc.v2.LedgerService/GetServiceInfo`, `/GetEpoch`, `/GetCheckpoint`, and `/GetTransaction`. The protobuf requests use uint64 epochs/checkpoint numbers, handled as `bigint` by the installed SDK; JSON evidence serializes them as decimal strings.

`GetEpochResponse.epoch` must contain the requested epoch and the explicitly requested `first_checkpoint` or `last_checkpoint`. The reader fetches the last checkpoint using `checkpoint_id.sequence_number`, with mask `digest,sequence_number,summary.epoch,summary.end_of_epoch_data`. The response must match the sequence, final validity epoch, and end-of-epoch marker. Independent responses must agree on the digest and both bounds. The method is appropriate for this evidence.

[Exact original-pattern reproduction](evidence/tatum-history-original-pattern-2026-11-05.json) retains the request, status, duration, sanitized detail and detail hash. The gateway supplied no useful error metadata on the 429 responses. [Paced diagnosis](evidence/tatum-history-diagnostic-2026-11-05.json) succeeds for the same historical requests, current reads, explicit current-epoch reads, default-mask historical reads, and direct checkpoint reads. Authentication, TLS, protobuf serialization, response parsing, and historical method support all worked. The earliest historical failures stored only `UNAVAILABLE`; their original wire details cannot be recovered, but the exact request pattern now reproduces the concrete 429 failure.

Classification: **recoverable quota failure**. It is not an unsupported method or pruning of the required epoch boundary, and it is not a PayGuard wallet-signing failure. A generic `UNAVAILABLE` remains a transport uncertainty unless a specific safe status pattern establishes a narrower cause. The sandbox also produced DNS-resolution failures during initial diagnosis; the network-enabled probes distinguish those local restrictions from provider responses.

## Actual coverage and canonical boundary

All four immutable preparations have inclusive validity epochs **1300–1301**. The independent providers observed canonical Mainnet genesis `4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S`, current epoch **1302**, reviewed protocol **139**, address-balance gas enabled, and multi-epoch transaction expiration enabled.

Both providers returned:

- Epoch 1300: first checkpoint **341020094**, last **341374210**.
- Epoch 1301: first checkpoint **341374211**, last **341729440**.
- Closed checkpoint **341729440**, epoch **1301**, digest **`HxSEAzGSWA1Cx8a4Ydtxrhpog4GiE9Cwju6pxy3gwp4X`**, with end-of-epoch data.
- Current epoch 1302 starts at checkpoint **341729441**.

The paced diagnosis observed Tatum's transaction/checkpoint retention floor **237661232**, and successfully retrieved that checkpoint (epoch 1017). The independent full-node floor was approximately **336540578**, advancing during the probes. Both floors precede **341020094**, and both tips exceed **341729440**. The eligibility report records each intent's exact floor after taking the stricter of the before/after observations. The full node returned `NOT_FOUND` for a floor checkpoint after its floor advanced beyond that checkpoint during diagnosis: this is a real retention example, separate from Tatum's HTTP 429 failure.

[Tatum archival documentation](https://docs.tatum.io/docs/full-nodes-and-archive) describes limited Sui retention, including its current-epoch/three-day wording. This is not a guarantee that every endpoint prunes every prior epoch, or proof that this specific request was pruned. The observed retained data is materially wider than that general description. Do not promise future retention from this snapshot. [Tatum's gRPC documentation](https://docs.tatum.io/oa/reference/sui-grpc) documents the TLS endpoint, API-key metadata, field masks and checkpoint access. [Sui's gRPC guide](https://docs.sui.io/develop/accessing-data/grpc/using-grpc) describes serving-floor metadata. Coverage here is the existing two-provider retention contract, not an exhaustive checkpoint scan or cryptographic non-inclusion proof.

## Historical alternatives and security justification

The smallest safe solution uses the **existing two independent providers** with corrected request scheduling. There is **no evidence-source substitution** and no relaxation of the eligibility validator, Mainnet identity, protocol-version review, expiry, closed-boundary agreement, history coverage, or complete-liability accounting.

[Sui's archival guide](https://docs.sui.io/develop/accessing-data/archival-store/using-archival-store) documents `archive.mainnet.sui.io:443` with the same `LedgerService` interface, explicit endpoint selection, and strict public limits. The [independent archive probe](evidence/tatum-history-archive-2026-11-05.json) returned canonical Mainnet identity, floor **0**, the genesis checkpoint matching that identity, epochs 1300/1301, and the same closed boundary/digest. It corroborates the current evidence; it is not used to bypass either mandatory provider or counted as independent of the Sui Foundation full node. No third-party archive account, plan, or new credential was provisioned.

For future genuinely pruned history, a reviewed archival integration would need to retain Tatum transaction observations, authenticate the archival endpoint's network and complete coverage, independently verify its checkpoint evidence, reject inconsistencies, and retain all original provider results. A bare archival `NOT_FOUND` or explorer page would be insufficient. [Sui explicitly describes this archival trust boundary](https://docs.sui.io/develop/accessing-data/archival-store/using-archival-store). Public archival endpoints are not a production SLA. No cached checkpoint file was promoted into chain evidence: prior captures are audit history, without an independently verified certificate/committee chain suitable for replacing live evidence.

## Implemented correction

- Move the existing preflight pacing queue into `src/lib/integrations/tatum-read.ts` and share it with recovery. Start at most two queued reads per second per process and serialize historical calls. Signing, execution and settlement are outside this queue.
- Retry a confirmed quota error once after 1100 ms. Record the first failure and successful retry. Persistent quota, ordinary transport errors, authentication failures, missing history and incomplete responses keep the hold. Different server instances can still share the key; the queue is not a distributed quota guarantee.
- Retain fixed per-call stage/method, attempt number, timestamp, classified code, whitelisted gRPC code, and an HTTP status only when it matches the exact fixed status format. Arbitrary provider messages, metadata, headers and credentials are excluded from recovery audit records.
- Read the original digest again after checkpoint verification. Retain both observations; a positive or incomplete response cannot be erased by a later `NOT_FOUND`.
- Keep freshness anchored to the beginning of the observation, so queueing and retries cannot make old epoch/digest evidence look fresh. Recheck identity and the stricter retention floor at the end.

The existing row-locked recovery procedure and its liability calculation are unchanged. It still fails closed, preserves original bytes/digest/approval/provider histories, prohibits disclosure/settlement/receipt evidence, counts settled and failed liabilities, and releases only one proven amount atomically. No force-release path was added.

## Read-only eligibility

The [fresh eligibility report](evidence/tatum-history-eligibility-2026-11-05.json) contains each observation's timestamp, exact digest, original validity, both current epochs, providers, coverage bounds, boundary proof, both finalized-transaction lookups, complete reserved-liability checks, retained wallet events, and limitations. It uses database-enforced **READ ONLY, REPEATABLE READ** snapshots and invokes only the evidence reader and pure assessor.

| Intent                                 | Digest                                         | Validity  | Reservation    | Observed eligibility | Production state |
| -------------------------------------- | ---------------------------------------------- | --------- | -------------- | -------------------- | ---------------- |
| `544d939d-02d5-4d98-b549-69fb9fb501e8` | `EDe8JMezpxR4qpWFiMQni6ETMdYfYXiM8Sdxnkzvse3s` | 1300–1301 | 1,000,000 MIST | Eligible             | approved; held   |
| `b0386342-a7c2-40ba-909e-9edf17501767` | `7GiPuDNq1vN8pLn2cqJf8kYMrt9zmbdDBbAfdoYtGdRj` | 1300–1301 | 1,000,000 MIST | Eligible             | approved; held   |
| `7a025238-06d9-43ca-8b5f-16ef7079f086` | `CcfxLSCtm6Nr6gZvLbif4dFYJTyt3ECCSDR4nMaQzGw6` | 1300–1301 | 1,000,000 MIST | Eligible             | approved; held   |
| `d23937ed-1907-4e40-8156-488f453a921a` | `7dDdwa2iHbGkXsmrk5wKT3TerFoQ46hMtEDaxq8vFiJR` | 1300–1301 | 1,000,000 MIST | Eligible             | approved; held   |

For every row, both required providers returned `NOT_FOUND` before and after boundary verification, both reported epoch 1302/protocol 139, and both covered the complete valid checkpoint window. No stored submission, payload hash, execution digest or receipt exists for these preparations. The original owner wallet-request/error events remain present; the report does not assert that no signature ever existed. Eligibility is a dated observation, not approval or an authorization token: recovery must repeat the checks with evidence at most 60 seconds old under the existing locks.

Fingerprint comparisons preserve all four intents and the three settled receipts with their reports, all original memory job/blob/namespace bindings (33 currently confirmed, 34 total rows), and the Harborline invoice/vendor/trust/instruction records. Reservations and provider/wallet histories were unchanged during the audit. No recovery audits exist; the three historical settlement-submission records and zero settling intents are unchanged.

## Proposed Production operation — requires separate approval

1. Review and deploy only this history-read correction and its tests/documentation. Keep `SERVICE_EXPIRED_RECOVERY_ENABLED=false` (or absent) for deployment verification. No schema migration, provider replacement, credential rotation, quote or payment is required. Existing unrelated working-tree/video changes are excluded.
2. After separate approval naming the four IDs above, temporarily set **only** `SERVICE_EXPIRED_RECOVERY_ENABLED=true` in Production and redeploy. Do not request any quote, prepare bytes, invoke `fulfillService`, sign, submit, or write Walrus data. Do not increase caps or edit reservations directly.
3. Sequentially call the existing owned route `POST /api/service-payments/<ID>/recover-expired` with `{ "confirmRecovery": true }`, same-origin and normal authenticated ownership. Three member intents require the customer's actual member session; the owner intent requires its original administrator session. The route derives the workspace from the authenticated session, accepts no tenant override, and checks ownership inside the locked transaction. Administrator credentials must never be used to access or recover the customer's private intents. Do not invoke the server function directly with a customer tenant ID, mint/reassign a session, or use SQL writes. If the agent cannot access the customer's legitimate authenticated browser session, the customer must make the approved requests in that session or provide an authorized browser connection; the agent must report that execution as inaccessible until then.
4. Suggested order: `544d939d…`, `7a025238…`, `d23937ed…`, then `b0386342…`. Fresh providers, protocol and accounting must pass for each call. Stop on uncertainty or a discovered transaction; preserve all evidence and reconcile any execution.
5. Expected member wallet and public-pilot totals: **3,000,000 → 2,000,000 → 1,000,000 → 0 MIST** in each ledger. Expected original owner-session total: **1,000,000 → 0 MIST**. Existing settled/failed liabilities in other sessions remain counted. The public ledger mirrors the three member reservations; it is not another 0.003 SUI onchain refund. Recovery moves no chain funds.
6. Each successful original intent changes `approved → expired-unexecuted`, with exactly one `service.expiry_recovered` audit containing original digest, validity, both providers' read/lookup histories, boundary/floor/tip evidence, reviewed rules, retained wallet-event summary, `releasedAtomic:"1000000"`, and the public-release indicator. No receipt/report is created. A repeated call releases `0`; an uncertain call records `service.expiry_recovery_held` with reason/evidence and releases `0`.
7. Verify all four original records and expected ledger deltas, preserve the three settled receipts/reports, memories and Harborline fingerprints, then restore **`SERVICE_EXPIRED_RECOVERY_ENABLED=false`** and redeploy. No new checkout is part of this operation.

The owner has now authorized the code deployment only. The temporary flag window, four original-ID recoveries with exact 0.001 SUI reservation reductions, verification, and flag restoration remain a **separate, unexecuted approval scope**. Exact Production flag verification requires authenticated Vercel environment access; the public release endpoint does not expose it. Never probe the recovery endpoint to infer the flag.

For interruption or lost-response handling, stop further calls and keep the checkout stopped. Inspect the original intent, recovery audit and complete liabilities read-only before deciding whether a request committed. A committed recovery remains terminal and must not be manually reversed. An uncommitted database transaction rolls back its intent, ledger changes and recovery audit together. A lost HTTP response does not establish rollback: only after read-only reconciliation and any needed renewed approval may the same owning session repeat the same original-ID procedure, which returns zero additional release for an intact completed recovery. If state, audits or totals disagree, leave financial records and audits intact and investigate; do not decrement or restore reservations by SQL or delete evidence. An authorized Vercel operator must disable recovery and verify the live deployment before any code rollback, since code rollback alone does not prove a disabled runtime flag. Reverting this code must never revert financial records, receipts, reports or memories.

## Nightly checkout

The owner-confirmed physical connection check is **MATCH**. One new **0.001 SUI Nightly checkout is not safe to start now**, because the four Production holds remain unresolved. After separately approved recovery completes, a fresh readiness check and explicit approval of one new purchase are still required. Physical financial signing remains unverified; connection MATCH does not certify a completed payment. Do not reuse the expired bytes or infer a payment failure from a missing digest alone.

## Validation

Final test counts and command outcomes are recorded in [the validation ledger](evidence/tatum-history-validation-2026-11-05.json). Unit/provider tests cover retained history, pruned/missing history, incorrect epoch/sequence/end marker, mismatched checkpoint digests, unavailable providers, other networks, quota cooldown/persistent quota, a transaction found after `NOT_FOUND`, and sticky positive evidence. Disposable database tests cover active validity, full-liability disagreement, unexpected settlement/confirmation/receipt evidence, repeated reconciliation, same-intent and shared-budget concurrent recovery, preservation and exact one-time release. Browser tests run only with new disposable PGlite, synthetic financial responses and no live credentials. The independent archival probe covers a valid archival network/floor/genesis/boundary response; no unimplemented archival recovery branch is claimed as tested.
