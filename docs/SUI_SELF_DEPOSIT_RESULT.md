# Confirmed Wallet A Mainnet self-deposit — October 30, 2026

**One genuine 0.005 SUI self-deposit succeeded. This is a wallet custody conversion, not an x402 service purchase.** No merchant payment or service settlement is claimed.

The owner used the existing Slush account to sign the exact refreshed transaction through Wallet Standard, then explicitly submitted it once through the separate localhost control. The tool verified the signature for Wallet A and required byte-for-byte equality with the frozen two-command transaction. Sender, destination and gas owner are the same configured Wallet A; Wallet B does not participate. No key/recovery phrase or replacement wallet was used.

| Confirmed fact                 | Actual result                                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Network                        | Sui Mainnet; native SUI, 9 decimals                                                                      |
| Digest                         | `6MXocsgenJghaAG5J7AAE9FqAEdkhrkjXgq13SiuBnMP`                                                           |
| Finalized checkpoint           | **339863005**                                                                                            |
| Execution                      | **Successful**, exact owner-approved BCS                                                                 |
| Conversion                     | **5,000,000 MIST = 0.005 SUI**, coin objects to Wallet A's address balance                               |
| Gas owner / sponsor            | Wallet A / none                                                                                          |
| Approved maximum gas           | **2,000,000 MIST = 0.002 SUI**                                                                           |
| Actual net gas                 | **100,099 MIST = 0.000100099 SUI**                                                                       |
| Computation / storage / rebate | 100,000 / 988,000 / 987,901 MIST; non-refundable storage fee 99 MIST, already included in the accounting |

| Wallet A native SUI |      Before |    Actual after |
| ------------------- | ----------: | --------------: |
| Coin objects        | 0.027993344 | **0.022893245** |
| Address balance     | 0.000000000 | **0.005000000** |
| Total               | 0.027993344 | **0.027893245** |

Only gas reduced total SUI. The 0.005 SUI remains owned by Wallet A in address-balance form. Actual remaining coins exceed the gas-cap worst-case minimum of 0.020993344 SUI. No additional funding is indicated for the existing service price under these observations.

The first independent native Tatum Mainnet reconciliation ran at `2026-10-30T18:17:33.617Z`, checking chain identity, finalized status, exact transaction bytes, native SUI balance changes, actual gas and both balance components. A separate command-line Tatum recheck at `2026-10-30T18:18:59.854Z` confirmed the same finalized checkpoint and balances. [Actual confirmed receipt](evidence/sui-self-deposit-confirmed.json). The source used for the owner-controlled execution is commit **62b0fa3274376b44f8ebb27fa4984966384fbe42**. A matching previously simulated digest was not treated as execution evidence until Tatum proved finalization.

Private signed payload, authorization and frozen attempt are retained under ignored `.data/sui-self-deposit/`; signatures and credentials are excluded from published evidence. The attempt is consumed and cannot sign/submit again. The localhost server was returned to default **read-only mode**, with signing/submission endpoints disabled. [Owner flow and safeguards](SUI_SELF_DEPOSIT_EXECUTION.md).

## Production readiness after conversion

An authenticated **read-only** Production check at `2026-10-30T18:21:12.815Z` passed all nine configuration, Tentacle and Tatum stages, with Tatum checkpoint **339863941**. Both deployed public addresses still match the original configuration. Wallet A's balance components are explicit, and Wallet B remains zero in all components. [Production readiness evidence](evidence/post-conversion-readiness.json).

- `readyForQuotePreparation`: **true**. The usable address balance exceeds the 1,000,000 MIST service price and 3,000,000 MIST session cap.
- Quote functionality: **still disabled** (`ENABLE_AGENT_PAYMENTS=false`); no quote was requested.
- Settlement: **still disabled** (`SERVICE_PAYMENT_SETTLEMENT_ENABLED=false`).
- Production Slush clearance / `readyForExactApproval`: **false**. A successful localhost signature does not clear the flagged production origin.
- Neon: **32 confirmed memories preserved; zero service receipts**. No memory write, reset, seed or migration occurred.
- Genuine x402 settlements: **zero**. No service purchase was initiated; it requires its own exact owner approval and the production security prerequisites.

## Validation

143 unit/integration tests across 21 files, lint, TypeScript, formatting and production build pass. Five [fully intercepted signing fixtures](evidence/self-deposit-signing-fixtures.json) test separate signature/submission actions, cancellation, changed bytes, uncertainty and expiry without real financial calls. [Review browser checks](evidence/self-deposit-signing-review-browser.json) cover 1280/360/390/430px. The actual owner-operated Slush conversion and Tatum receipt above are additional real evidence; they do not certify hosted payment signing. [Confirmed receipt browser checks](evidence/self-deposit-confirmed-browser.json) inspect the actual read-only result and disabled financial controls. [Desktop](screenshots/self-deposit/confirmed-1280.png) · [390px](screenshots/self-deposit/confirmed-390.png). Public address is masked in captures.

An initial credential-scan attempt overlapped the production build and could not read the temporarily absent `.next/static`; the completed-build scan passed with 452 files and the final evidence scan passed with **459 files and zero credential matches**. The [first actual-receipt browser run](evidence/self-deposit-confirmed-browser-first.json) passed desktop but found mobile overflow from the full digest in the execution status; its wrapping was corrected for the passing four-viewport rerun. Historical failed/blocked tests remain preserved in their earlier ledgers. No demo video was produced.
