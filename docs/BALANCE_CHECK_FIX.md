# Mainnet balance-check correction — October 30, 2026

Recovered local/GitHub/deployed commit `eb36a4f`, with no tracked edits or divergence. Preserved `.gitignore.save`. The owner had already configured valid, distinct Wallet A / Wallet B public addresses in Vercel Production. Both payment switches were disabled. No configuration, wallet, key, account, database or memory was replaced.

## Observed causes

The authenticated production setup reproduced the generic failure. Tentacle `/supported`, Tatum TLS gRPC authentication/connectivity, full Mainnet genesis, native SUI metadata (9 decimals), and the address-balance gas feature passed independently. The actual balance path had two defects:

1. The five-read preflight burst exceeded the provider's per-second allowance. Tatum returned HTTP **429**, wrapped by the gRPC library as **`UNAVAILABLE`**, with the fixed message `Received HTTP status code 429`. The setup catch discarded that diagnosis. Tatum documents a 3-RPS free-plan allowance ([plans](https://docs.tatum.io/js/docs/plans-limits), [HTTP 429](https://docs.tatum.io/docs/error-429)); the observed response proves rate limiting, without assuming private plan details.
2. Successful balance responses omitted zero components. Wallet A explicitly returned total `27993344` and coin balance `27993344`, omitting address balance. Wallet B explicitly returned total `0`, omitting both components. The parser incorrectly required all fields. A failed account also discarded the other result through the combined promise.

The selected Sui schema exposes total, coin and address balance as optional protobuf fields ([official schema](https://github.com/MystenLabs/sui-apis/blob/main/proto/sui/rpc/v2/state_service.proto)). The fix requires an explicit native-SUI total. If one component is missing, the other component and total determine it exactly. If an explicit total is zero, nonnegative components are both zero. Missing entire results, missing total, ambiguous nonzero totals, wrong assets, negative values and inconsistent sums remain unknown/failures. No missing or failed result is converted to zero.

## Changes and boundaries

Read-only preflight RPCs are serialized and paced at two starts per second per process. A gateway quota response permits one cooled-down **read-only** retry; persistent quotas remain visible. Other server instances or integrations may share a key, so this is not a global quota guarantee. No financial operation uses this retry path.

Setup returns safe diagnostics for configuration, Tentacle support, Tatum connection/authentication, chain identity, native units, protocol features, each wallet, and party separation. Each has stage, classification, safe code, timestamp, explanation and action. Arbitrary provider messages, headers and credentials are excluded. A failed account/provider preserves successful wallet results; prior successful values are explicitly stale after a later failed check and cannot satisfy current readiness.

The full addresses occupy separate blocks above their Copy controls. Both wallets have native total/coin/address amounts, role-specific readiness, successful-check timestamps and retry/progress states. Quote preparation being disabled is explicit; balance checks require neither enable flag nor signing.

Wallet A's observed `0.027993344 SUI` is sufficient in coin objects for the `0.001 SUI` service price, but its usable address balance is zero. Review a separate owner-controlled conversion of at least the service amount, plus that conversion's actual gas requirements; no additional service funding is indicated by this snapshot. Wallet B requires no funding to receive the selected sponsored payment. Neither conversion nor funding is performed here.

All read-only checks can pass while quote readiness remains false because the payer lacks usable address balance. Keep `ENABLE_AGENT_PAYMENTS=false` and `SERVICE_PAYMENT_SETTLEMENT_ENABLED=false` during this fix. After usable funds and fresh checks pass, quote preparation may use `mainnet` with settlement still false. The unresolved Slush warning, hosted signing pause and exact per-purchase owner approval remain. No settled x402 payment is claimed. No video.

## Evidence

- [Corrected local code against genuine Mainnet responses and deployed public addresses](evidence/balance-fix-local-mainnet.json). This is not a Vercel execution claim.
- Production verification and final test results will be recorded after the validated engineering deployment.
