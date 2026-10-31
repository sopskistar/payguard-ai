# October 31 — current non-spending verification

Fresh authenticated Tatum Mainnet and Tentacle checks passed at checkpoint **340100235**. Both configured parties still match their existing public addresses. Wallet A has **0.027893245 SUI total / 0.022893245 coin objects / 0.005 address balance**; Wallet B is explicitly zero in all three components. [Dated provider response](evidence/oct31-readiness.json). Mainnet quotes are enabled, Production settlement disabled. The [owner-local application workflow](LOCAL_OWNER_PAYMENT.md) is a separately inspected deployment, not production Slush clearance.

One clearly synthetic invoice-analysis request was added for the controlled first-party experiment. No prior invoice was replaced, no memory was created and **32 confirmed Walrus records / zero service receipts** remain. The successful self-deposit below remains distinct from an x402 purchase. No service digest, merchant credit or delivered paid report is claimed before actual owner authorization and independent verification.

---

# Mainnet proof ledger

## Genuine service quotes and unsigned simulation — October 30, 2026

Production returns genuine x402 v2 HTTP 402 for the existing synthetic NS-1048 anomaly. Native SUI price **0.001**, configured payer/merchant, Tentacle sponsor terms, header/body agreement and idempotency pass. Audit quotes are cancelled without approval. [Live quote evidence](evidence/final-x402-production-quote.json). The exact two-command address-balance transaction passes actual unsigned Mainnet simulation with checks enabled, no mocked gas, simulated merchant credit **1,000,000 MIST**, zero payer gas and **100,000 MIST** sponsor gas. [Unsigned proof](evidence/final-x402-unsigned-simulation.json). **Its digest is not a settled transaction. Zero genuine service receipts exist.** [Actual versus simulated scope](FINAL_X402_READINESS.md).

## Confirmed wallet custody conversion — October 30, 2026

One owner-approved **0.005 SUI Wallet A self-deposit** finalized at checkpoint **339863005**, digest `6MXocsgenJghaAG5J7AAE9FqAEdkhrkjXgq13SiuBnMP`. Native Tatum Mainnet gRPC independently verifies success, exact approved bytes, actual gas **0.000100099 SUI**, and final Wallet A coin/address balances **0.022893245 / 0.005 SUI**. [Actual receipt and boundaries](SUI_SELF_DEPOSIT_RESULT.md). **This is not an x402 purchase.** Fresh Production audit confirms 32 preserved memories and zero service receipts; payment switches stay false and production Slush clearance remains unresolved.

## Fresh recovery recheck — October 30, 2026

All **32 tracked confirmed records (30 original owner + 2 controlled tenant)** passed fresh SDK job/blob/namespace checks without writes. Neon contains **zero genuine service-payment receipts**. [Audit](evidence/session-recovery-audit.json). Production owner login/logout, Neon persistence, fresh-session recall (OFF 0 / ON 7 owned citations), unchanged baseline holds and actual Tatum Mainnet reads passed on `7531455` before the engineering update. [Core evidence](evidence/production-core-smoke.json). This does not prove funded wallet or x402 settlement compatibility.

**October 29 continuation:** all original 30 provider jobs/blobs were independently reconfirmed. Two additional sponsored records belong to separate controlled tenant identities, bringing the tracked total to **32**. They are separate from the original owner collection below. Both later authenticated sessions recalled their own confirmed correction on a new synthetic invoice; foreign invoice/memory access was denied in both directions. [Live controlled API proof](evidence/two-tenant-mainnet-memory.json) · [independent SDK job/blob/namespace recheck](evidence/two-tenant-provider-recheck.json). This used a loopback application with real Neon/Walrus, not a physical hosted wallet or a cleared Slush domain. No reseed, renewal or financial transaction was submitted.

Verified on October 28, 2026. **30 distinct confirmed Walrus memories**, including the original 12 seeds, the original cross-session correction and 17 new learning events. Expansion confirmed at `2026-10-28T23:00:52.070Z`, with zero pending or failed records. The business scenarios are synthetic; the Mainnet writes and returned IDs below are real. No pending job is counted.

Memory account: `0x7cf55b418a403dc667fcd98296fb05d894faef3b3a96657e06ef8108e45ff301`. Namespace and returned completion evidence are in [the reviewed JSON export](evidence/walrus-confirmed.json). These are SDK/provider completion records persisted in Neon, not a promise of indefinite retention. Public delegate identity for the submission dashboard still needs owner verification (`MEMWAL_AGENT_ID`).

| #   | Accepted job ID                        | Confirmed blob ID                             | Recorded completion (UTC) |
| --- | -------------------------------------- | --------------------------------------------- | ------------------------- |
| 1   | `4d590890-db79-4329-986f-10f52d32d5c7` | `pPYsV-RKCESYlutuJDdc9lj9pxV2ixSA_zMHRDr2CM4` | 2026-10-28T04:04:48.866Z  |
| 2   | `7eb9e830-f07a-49f0-8fdb-f06c30033710` | `mLNTvTJEDoZx11lGldhBb3ngfNCO1Qj5-doyCGgR8mc` | 2026-10-28T04:45:54.099Z  |
| 3   | `ede83c85-4754-492f-9b4e-063271514fa0` | `UQpmPhtm_BN7bvLvpNoW8LYvYpsv2TlCC7hxpAlPISo` | 2026-10-28T04:46:41.974Z  |
| 4   | `d2e31673-4e63-443c-9be4-bcc5904c8d0f` | `qLaF2a1YAi44wFRsC4NLKjs64nBaLS-tP5_NoRYyggg` | 2026-10-28T04:47:06.001Z  |
| 5   | `64967cb7-be54-445c-bda3-46058a28f6db` | `k_VAehYdw7pjBjGTW4X4gOjCS4xDIheFZoItuHWMHyQ` | 2026-10-28T04:47:54.336Z  |
| 6   | `0c40bf91-2fb7-4d13-ab72-87487451321b` | `i3nSnl9ix5Es129QXaW1gUggnN6t0NaNAZubOMyb-G4` | 2026-10-28T13:55:55.011Z  |
| 7   | `2c3f4303-db02-4e83-b50e-6083bc2fae5f` | `3F43tEG4dK-y6V_QLEoeMi-PELKOUp_K4pM2_2Am_UQ` | 2026-10-28T13:55:57.379Z  |
| 8   | `1e7b369e-fd61-465f-8703-d7a4df8538c6` | `ldkbtwmCXX_x1u6_Vy38jJKELq_Xy1Pp1FSaGGtQ7Pg` | 2026-10-28T13:55:59.672Z  |
| 9   | `16a54f01-77c3-4b53-99fe-1660a0f20f79` | `9DkeMtB6hOAZwDsUd4UCUkF4YQwKlouPXAEMV8q-K10` | 2026-10-28T13:59:44.080Z  |
| 10  | `95eb74ae-c9ff-408b-a8fc-107fd7accf5a` | `sbJPgBU54G1KDIX3Kw4qoGDbKKLn3SCyaW8zgG2LR_c` | 2026-10-28T13:59:47.002Z  |
| 11  | `81987007-400e-443d-aeee-f146d3290b30` | `Bp73ib3naV1TrRpE8qKYi6cZwYep_G3dt6JaNuHosWA` | 2026-10-28T13:59:49.526Z  |
| 12  | `3e956589-5a2a-4a9d-98c1-5faec6b86bfb` | `PiI7OOBTnlXTA4GHbR5pSDXzMsb9_TfJ-DeSgazvmDE` | 2026-10-28T13:59:52.500Z  |
| 13  | `6fb7fcb6-4986-4375-a1de-575be96436f4` | `T5Zlt_7PXvQaySFPOIY0VqmTxz4n8WZYZV2MAgb5p1U` | 2026-10-28T14:08:28.594Z  |
| 14  | `26b9f3b6-7421-429c-9450-5cdf00341235` | `8PhJP7PFwXG-NmJ_Tvd36RaGKZs10uVffA7XBWtE_5A` | 2026-10-28T22:55:41.675Z  |
| 15  | `83e59f14-0679-4557-87f9-c6432166aa30` | `-8Zr3bN7mKSTnqW9hF1gfH3mKOb6qm2uLPOCXMpbP9k` | 2026-10-28T22:57:20.833Z  |
| 16  | `fad578ba-7a66-42be-9699-d24504af803c` | `o_e8TXMGdpQ-vLtPoRFwzNBmThuPSCnIxszMyeFQSOk` | 2026-10-28T22:58:08.595Z  |
| 17  | `416cff4b-7b15-4521-b003-92e71baa44df` | `v8OD2R59cXEjANkoV5UY9HSIInE-SY1tOBzZY7uerYQ` | 2026-10-28T23:00:13.465Z  |
| 18  | `19d5921c-de93-47b3-a760-3f499ec9d23f` | `9Z2VE-rj2-XE8s_KdqfUEenuJgLwGNz5-DCAyRM8Eks` | 2026-10-28T23:00:16.055Z  |
| 19  | `bf0c610a-c854-4b85-a54c-2a782c46896f` | `XlBuCNiCJsPVn4iSW07zzvIoumMieGUyxPMaJxNWg5k` | 2026-10-28T23:00:18.734Z  |
| 20  | `303659ee-6607-4868-89b5-3e632bf2fd11` | `yk1vnCv-fnHh3S0Oxc61RnXMWshJdqAJ0f5VlD1hosI` | 2026-10-28T23:00:21.446Z  |
| 21  | `474a6a64-ad05-4ed7-b5f4-a22acfabade7` | `3WogKM2IAtehjpvTCgIWpi3S7-Ciy5rJw4usKe-bf2g` | 2026-10-28T23:00:26.355Z  |
| 22  | `292820cd-b090-4a63-900b-b4e605425fb7` | `t8xATUp5_3_L79mG2DCTTq1jN0N3zQNcef15kYZOvdw` | 2026-10-28T23:00:29.091Z  |
| 23  | `869d5212-09a0-4ecd-9f39-5ae0b2291db8` | `4OkVDojIGY0q4WzmANQUuuKkYaFeyPdIhjDb48GVyOM` | 2026-10-28T23:00:31.688Z  |
| 24  | `66cb45d5-af9b-44f6-9b39-0e10437a93e4` | `_1bwWsj7Si4TGFuM4PH0tKIsINrAd7Lc23mbJFYGFZ4` | 2026-10-28T23:00:34.695Z  |
| 25  | `5425784b-fa5f-4640-a935-3024e4333f86` | `F_1Poe3UQ3lKnvnnwZyIdSlvDPBoYDvgGhDEvxsQFSY` | 2026-10-28T23:00:37.236Z  |
| 26  | `b1c59b64-faab-4e6d-b66c-b914be699a7b` | `gDt16mmOG810QixENGVgyaEB_2ospWC19Fpild32BhI` | 2026-10-28T23:00:39.722Z  |
| 27  | `b39fdc9f-ff2f-430b-8f35-b2db62ddb414` | `7LxVCj03Q9JztRjE7Jir_7M4YERHG9KlrM0SaPsa6vY` | 2026-10-28T23:00:42.656Z  |
| 28  | `f5e84c1e-11e7-44e1-84ce-0e1d6c8e7f98` | `PyiSfvA2yS_8Xa3PZGVDDVhRMVNJKT6n5lDGjsm9a50` | 2026-10-28T23:00:45.559Z  |
| 29  | `12ae081e-cbe0-488a-abd5-f1793e6280b4` | `lBa7czw0MVB1oZeclRzmMtD7e8u2hvzySnyiY4vne4E` | 2026-10-28T23:00:48.078Z  |
| 30  | `afa56c92-971e-42bd-b2d2-b865f0a1a705` | `56SOSxSVJVwSkZGFmCN7Sx2DUMBLlovypLYfSFrMoW4` | 2026-10-28T23:00:50.668Z  |

## Recall that changed a later review

[Fresh-process evidence](evidence/recall-new-process.json), recorded at 2026-10-28T14:06:45.669Z: a newly created synthetic invoice was evaluated OFF, then ON through actual semantic recall. OFF retained `trusted-recipient-change` and `recipient-change` findings, with no memory citations. ON retrieved 12 confirmed payloads; three applicable vendor policies influenced the final review and were cited. The returned blobs were:

- `k_VAehYdw7pjBjGTW4X4gOjCS4xDIheFZoItuHWMHyQ`
- `pPYsV-RKCESYlutuJDdc9lj9pxV2ixSA_zMHRDr2CM4`
- `i3nSnl9ix5Es129QXaW1gUggnN6t0NaNAZubOMyb-G4`

The baseline was “Needs review”; the remembered review was “High risk / verification required.” Neither path approved payment. The human-verification gate remains separate and mandatory for changed instructions.

The opt-in Playwright live test also **passed in 56.8 seconds** against the local production build and real Neon/Walrus: create a correction → confirm its blob → create a later invoice → log out → close browser context → authenticate in a fresh context → recall that exact new blob → assert a finding cites its memory record. This is a separate result from the mocked unit suite. See `tests/e2e/live-memory.spec.ts`.

## Tatum Sui Mainnet

[Authenticated native gRPC evidence](evidence/tatum-live.json): chain identifier `35834a8a`, genesis digest `4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S`, service checkpoint `339079915` at `2026-10-28T14:17:02.956Z`. TLS endpoint: `sui-mainnet-grpc.gateway.tatum.io:443`; server-only `x-api-key` metadata.

Real inspected transaction: [os1iG8zow278c6hqxbuyxnvMUjzThsD8GTY8atdfzW6](https://suiscan.xyz/mainnet/tx/os1iG8zow278c6hqxbuyxnvMUjzThsD8GTY8atdfzW6), finalized in checkpoint `339078672`. It executed successfully and reported a sender SUI debit of `101473` atomic units; it did **not** pay the sample supplier.

[Live reconciliation](evidence/tatum-reconciliation.json) correctly returned **Mismatch**. Coin metadata returned 9 decimals; the synthetic invoice expected `500000000000` atomic units and received zero. No invoice was marked paid. The real Tatum browser test also passed through Transaction Inspector and Verify payment in the production UI, displaying this mismatch. Positive-match and uniqueness paths are covered by synthetic unit/database tests; no live positive supplier payment is claimed.

Latest-checkpoint discovery was intermittent and is not a complete history indexer. Manual digest inspection and live coin-metadata reconciliation succeeded. Missing/pruned/provider failures remain visible; no fixture fallback exists.

## Reproduce

```bash
npm run memory:seed       # Reuses the same 12 operations; confirmed jobs are never rewritten
npm run memory:prove-recall
npm run proof:export
TATUM_TEST_DIGEST=os1iG8zow278c6hqxbuyxnvMUjzThsD8GTY8atdfzW6 npm run check:live
```

Configure credentials privately as described in [the integration guide](INTEGRATION_GUIDE.md). Public JSON files contain reviewed proof identifiers and synthetic invoice evidence only. Full runtime exports remain ignored in `.data/`. Deployment validation is recorded separately in [test results](TEST_RESULTS.md); Mainnet CLI results alone do not prove Vercel connectivity.

## Thirty-memory expansion

The original thirteen were rechecked through `getRememberStatus`: all were `done` with matching blob IDs. The [pre-write cost and retention inspection](evidence/memory-cost-preflight.json) and [managed-relayer guidance](https://docs.wal.app/walrus-memory/sdk/production-readiness) were reviewed before the bounded 17-event expansion. Writes are sponsored; application quotas remain enforced. No funding or storage-renewal payment was sent. Initial records report end epoch 57 and May 2027 expiry; renewal is not automatic.

Seventeen stable operation keys cover known contacts, suspicious changes, mistaken assessments, duplicate corrections, thresholds, scoped synthetic exceptions and outdated policies. Pending jobs resumed their original IDs; the second pass confirmed all thirty. [Live quality measurements](MEMORY_EVALUATION.md): 4/4 supplier reviews influenced, 4/4 baselines preserved, zero stale/wrong-scope applications, zero added critical warnings on one unchanged control. The [public judge sandbox](https://sopskistar.github.io/payguard-ai/try/) uses recorded real recall through the same deterministic logic.

## October 29 read-only revalidation

The SDK provider recheck confirmed all 30 original job/blob pairs remain completed and matching: [provider recheck](evidence/provider-recheck.json). Fresh live recalls drove the expanded [18-case measured learning report](MEMORY_EVALUATION.md), and the complete browser suite re-used the existing correction across a new owner session. No additional writes or retention payments were made. The public proof view is https://payguard-ai-henna.vercel.app/proof.
