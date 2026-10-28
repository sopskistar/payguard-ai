# Mainnet proof ledger

Verified on October 28, 2026. **13 distinct confirmed Walrus memories**, including all 12 idempotent synthetic seed policies and one live browser-test correction. The business scenarios are synthetic; the Mainnet writes and returned IDs below are real. No pending job is counted.

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

[Live reconciliation](evidence/tatum-reconciliation.json) correctly returned **Mismatch**. Coin metadata returned 9 decimals; the synthetic invoice expected `500000000000` atomic units and received zero. No invoice was marked paid. Positive-match and uniqueness paths are covered by synthetic unit/database tests; no live positive supplier payment is claimed.

Latest-checkpoint discovery was intermittent and is not a complete history indexer. Manual digest inspection and live coin-metadata reconciliation succeeded. Missing/pruned/provider failures remain visible; no fixture fallback exists.

## Reproduce

```bash
npm run memory:seed       # Reuses the same 12 operations; confirmed jobs are never rewritten
npm run memory:prove-recall
npm run proof:export
TATUM_TEST_DIGEST=os1iG8zow278c6hqxbuyxnvMUjzThsD8GTY8atdfzW6 npm run check:live
```

Configure credentials privately as described in [the integration guide](INTEGRATION_GUIDE.md). Public JSON files contain reviewed proof identifiers and synthetic invoice evidence only. Full runtime exports remain ignored in `.data/`. Deployment validation is recorded separately in [test results](TEST_RESULTS.md); Mainnet CLI results alone do not prove Vercel connectivity.
