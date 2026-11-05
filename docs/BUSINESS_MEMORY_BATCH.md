# Proposed Walrus business learning batch

**Awaiting owner approval. No writes have been executed.**

Batch digest: `d6117ac6e40d2d59125454dfdb2bd29594ebf7ac8271785965e2da5c0eb9bc15`

Destination account: `0x7cf55b418a403dc667fcd98296fb05d894faef3b3a96657e06ef8108e45ff301`

Onchain account owner: `0x9c9f7a5f3562be063f8cdac9eb34b51e888c3267eac952282ed4ab52cc4ad377`

Namespace: `payguard-v1-6ccb21624a510029c350b89da522cf9c`

34 distinct provider-verified Mainnet blobs → target 50. This batch contains exactly 16 distinct synthetic records, 8,193 UTF-8 bytes in total.

The application retains 33 confirmed rows and one older pending row. A read-only audit independently established that the pending job is already completed, currently listed and retrievable with its exact decrypted text. Its customer-owned database status was not changed through an administrator session. It is included in the provider count, and remains unavailable to application policy until legitimately reconciled. No new write produced this additional existing blob.

This revised proposal supersedes the earlier 17-record digest beginning `55c3168e`. The new digest above requires its own exact approval. BUS-04 remains a local invoice-exception test but is omitted from this write batch; that behavior already has existing evaluation coverage.

Estimated direct owner-wallet cost: **0 SUI / 0 WAL**, using the existing managed sponsored relayer. Maximum paid operations: **0**. No funding, renewal, paid fallback or financial transaction is authorized. Stop on unavailable sponsorship, exhausted quota, unexpected charges, ownership changes or ambiguous accepted jobs. Sponsored storage retention follows the provider epochs; no automatic renewal is authorized.

This is a sponsored-path estimate, not a fiat billing quote. The operator must not fund or pay the relayer if the sponsored path is unavailable.

| ID     | Synthetic supplier         | Learning purpose                                                                  | Expected applicability |
| ------ | -------------------------- | --------------------------------------------------------------------------------- | ---------------------- |
| BUS-01 | Alder Paper Synthetic      | Retain the independent callback requirement on later destination changes.         | apply                  |
| BUS-02 | Birch Components Synthetic | Escalate subsequent substitution attempts.                                        | apply                  |
| BUS-03 | Cedar Freight Synthetic    | Remember that repeated billing requires line-item comparison.                     | apply                  |
| BUS-05 | Elm Packaging Synthetic    | Preserve established-channel separation.                                          | apply                  |
| BUS-06 | Fir Equipment Synthetic    | Escalate conflicting source instructions.                                         | apply                  |
| BUS-07 | Grove Design Synthetic     | Correct a false positive while retaining source checks.                           | apply                  |
| BUS-08 | Hazel Legal Synthetic      | Prove superseded context does not influence a new review.                         | exclude-superseded     |
| BUS-09 | Iris Hosting Synthetic     | Keep expired guidance out of approval decisions.                                  | exclude-expired        |
| BUS-10 | Juniper Labs Synthetic     | Remember that changed snapshots require a new maker-checker review.               | apply                  |
| BUS-11 | Hazel Legal Synthetic      | Demonstrate a current policy winning over a conflicting older memory.             | apply                  |
| BUS-12 | Kestrel Parts Synthetic    | Test exact supplier scope rather than name similarity.                            | exclude-other-supplier |
| BUS-13 | Larch Office Synthetic     | Test tenant-owned namespace and exact policy binding.                             | exclude-other-tenant   |
| BUS-14 | Maple Media Synthetic      | Make payment-link changes visible on future reviews.                              | apply                  |
| BUS-15 | Nettle Supply Synthetic    | Retain prompt-injection resistance as a durable policy.                           | apply                  |
| BUS-16 | Oak Maintenance Synthetic  | Require source checking for OCR-derived destinations.                             | apply                  |
| BUS-17 | Pine Consulting Synthetic  | Demonstrate later-session recall with provenance while preserving baseline holds. | apply                  |

The exact text, policy IDs, synthetic fixture fields, namespace, per-record hashes and operation keys are in the [complete manifest](evidence/business-memory-proposed-batch.json). Synthetic invoices and policies are explicitly marked as test data and do not attest to a real supplier check. Soft policies cannot suppress baseline holds or apply to real invoices. BUS-08 and BUS-09 deliberately retain superseded/expired context to test its exclusion; the count includes historical learning, not 50 simultaneously applicable rules.

Execution uses the existing idempotent memory-job integration. It preserves the original 34 database rows, verifies the current Mainnet account owner, collects accepted job/blob/namespace evidence, and stops on the first uncertainty. A pending job is reconciled by its original operation key, never replaced with another write. Later-session recall and exact-provenance tests follow confirmed completion.

Local tests cover the scenario contracts, manifest tampering, duplicate records, foreign namespaces, wrong ownership, non-synthetic/hard rules and nonzero paid-operation limits.
