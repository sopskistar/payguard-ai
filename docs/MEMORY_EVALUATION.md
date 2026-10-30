# Memory Learning Report — current release

## Recovery rerun — October 30, 2026

Four fresh real recall queries again met **18/18 authored synthetic contracts**: 11 required holds, 7 allowed, zero false/missed holds in this set, baseline preserved in all 18, no stale/wrong-scope rules applied, 59 applied / 481 excluded candidate-case pairs. [Dated report](evidence/learning-report.json). No new memories or payments were created. The separately proposed [memory-informed purchase experiment](PAYMENT_EXPERIMENTS.md) is not yet performed; no avoided-purchase or paid-analysis improvement is claimed.

Fresh SDK/Neon recheck on October 29: **30/30 existing jobs completed with matching blobs**, 30 retention records; no write or renewal. The repeatable 18-case run again met all contracts using four real recalls. Within this authored dataset, 11 scenarios required a hold and 7 allowed approval: **0 false holds and 0 missed holds**. The engine applied 59 candidate/case pairs and excluded 481. Exclusion includes scope, supersession and relevance/applicability; it is not a measured semantic irrelevance score. [Raw results](evidence/learning-report.json) · [SDK status check](evidence/provider-recheck.json). Runners without working Neon WebSockets can use `npm run memory:evaluate-learning -- --http` and `npm run memory:preflight -- --http --publish`; this script-only HTTP adapter does not replace the application's transaction-capable runtime.

Two independently authenticated local test users exercise tenant-scoped APIs. A mixed SDK mock returns both users' records plus tampered text while both users own jobs; only the exact authenticated user's blob/text is returned. This is a security contract, not a new pair of live customer Mainnet memories. The design follows the official [server-managed multi-tenant pattern](https://docs.wal.app/walrus-memory/sdk/cookbook-multi-tenant): the operator controls the account/delegate, while server authentication and ownership checks enforce customer access. Namespaces alone grant no security, and this is not end-to-end encrypted storage. Production wallet onboarding remains [paused for Slush review](SLUSH_SECURITY_REVIEW.md).

The new 18-case suite performs four genuine SDK semantic recalls against the preserved confirmed Mainnet records, then reuses those exact results across explicitly synthetic invoice/instruction variants. No new memories are written. Run `npm run memory:evaluate-learning` in a fresh process.

[Initial result](evidence/learning-before.json): 15/18 contracts met; three of four unchanged controls gained unnecessary critical address warnings. [Corrected result](evidence/learning-report.json): **18/18 contracts met, 18/18 baseline findings preserved, 4/4 recalls returned confirmed candidates, 0/4 unchanged controls gained critical warnings, zero stale/wrong-scope applications**. Sixteen cases applied remembered context. Only 10.9% of candidate/case combinations were applicable; broad retrieval remains a limitation and scope filtering is essential.

The initial failing controls revealed that the learned address rule compared against sparse invoice history even when the proposed address matched the established supplier reference. The correction uses that canonical reference for the learned change condition while preserving baseline checks and the separate hard approval gate. Three new regression cases lock in that behavior.

Cases cover four suppliers, changed and unchanged recipients, invoice directives and verification bypass attempts, an exact synthetic human-verified exception, expiration, edits after verification, duplicates, thresholds and local policy supersession. The latter uses a synthetic superseded local policy input while retaining actual retrieved citations. No provider record was edited. Separate unit cases cover contradictory exception text, later-session variants and narrow invoice scope.

These are authored contract checks, not real-world fraud detection accuracy, a randomized experiment or a semantic ranking precision score. A human-verified exception can permit review approval while informational/critical contextual findings remain visible. No reduction in actual financial loss is claimed. The public [learning report](https://payguard-ai-henna.vercel.app/proof#learning) includes every measured case.

---

## Earlier four-supplier evaluation (preserved)

# Measured learning quality

The [October 28 live run](evidence/memory-quality.json) used five real SDK semantic recalls in a fresh process against the configured owner's namespace. Four supplier scenarios and one unchanged-invoice control are synthetic. Exact confirmed text/blob provenance, tenant ownership, scope, active/superseded state, expiry and currency constrain application.

| Measurement                                                 | Actual result                          |
| ----------------------------------------------------------- | -------------------------------------- |
| Supplier scenarios with an applicable recalled policy       | 4 / 4                                  |
| Baseline findings retained with memory ON                   | 4 / 4                                  |
| Applied stale, expired, superseded or wrong-vendor policies | 0                                      |
| Added critical findings on unchanged control                | 0                                      |
| Applied citations by supplier                               | Northstar 8; Orbit 5; Forma 3; Lumen 2 |

The relayer returned 30 candidates per query. This hits the configured result cap; it does not prove that arbitrary future queries retrieve all relevant policies. Most returned candidates were inapplicable and were filtered before influencing a decision. These measurements demonstrate application policy enforcement and recall impact on this corpus; they are not a general fraud accuracy, ranking precision or recall-at-scale benchmark. No false-positive reduction is claimed from a control that started at zero critical warnings.

The original write → confirmation → logout/new session → exact blob recall browser test passed before expansion. The current browser test can use `LIVE_MEMORY_REUSE=1` to demonstrate that same persisted correction across new authenticated contexts without generating another write. A fresh captured replay is published for public judges at [the sandbox](https://sopskistar.github.io/payguard-ai/try/).

## Dataset and cost control

Original 13 records are retained. Seventeen additional event keys in `src/lib/learning-events.ts` cover established contact preferences, suspicious recipient changes, corrected mistaken assessments, duplicate billing, current thresholds, invoice-scoped synthetic exceptions, and explicitly outdated rules. Old/expired rules remain in memory for provenance but cannot authorize new decisions.

Before expansion, read-only SDK job status and listing calls verified the existing 13 completions and retention. The official managed relayer sponsors writes; request quotas still apply. Expansion was capped at 17 new operations and 30 total durable jobs. A first pending response was resumed by the same ID; all 30 later confirmed. No spending wallet, funding payment or renewal transaction was used. Retention ends and renewal must be monitored; see [cost preflight](evidence/memory-cost-preflight.json).

```bash
npm run memory:expand             # dry run
npm run memory:expand -- --execute # authorized bounded resume; requires recent preflight
npm run memory:evaluate
npm run judge:evidence
npm run proof:export
npm run judge:publish-build
```

Results are written only after real responses succeed. SDK unavailability must be reported as a failed/unavailable evaluation, never replaced with fixtures. Unit tests use explicitly synthetic mocks and are counted separately.
