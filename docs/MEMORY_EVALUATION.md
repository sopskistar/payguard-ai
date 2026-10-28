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
