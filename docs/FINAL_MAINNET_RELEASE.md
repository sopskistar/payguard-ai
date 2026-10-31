# October 31 Mainnet continuation

The existing application, database, owner accounts, public wallet addresses and all 32 confirmed Walrus records are preserved. One genuine x402 service purchase is verified. Two additional purchases await separate owner-controlled financial authorization and signatures. This is an engineering release with an outstanding financial/physical-wallet acceptance boundary, not a claim of three completed payments.

## Confirmed first purchase

| Field                      | Independently verified result                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Invoice                    | Synthetic `X402-OWNER-20261031-01`                                                                                              |
| Quote                      | `51d204df-71fd-44a6-ac4a-c8e0c50b4cf5`                                                                                          |
| Mainnet digest             | [`68bhHRKzrQang8xohsahBQbehoZ4SjApQJ1U1Wf2ppyx`](https://suivision.xyz/txblock/68bhHRKzrQang8xohsahBQbehoZ4SjApQJ1U1Wf2ppyx)    |
| Checkpoint                 | `340211024` · finalized successful execution                                                                                    |
| Payer / Wallet A           | `0xc0f3fbf8a029fe354571b58d9e079c1aa4e9ca111a2b025dca470d4bc96397a8`                                                            |
| Merchant / Wallet B        | `0x99eac0f7be358adf9f96ce0490392f356332af96376aadf11d829a529c1a189e`                                                            |
| Native SUI merchant credit | **1,000,000 MIST = 0.001 SUI**                                                                                                  |
| Native SUI payer debit     | **1,000,000 MIST**, no payer gas                                                                                                |
| Gas sponsor                | `0x6d8c6e978808e81344b6ddcc741b06d2b2b1106066d218683e0161f696878b61`                                                            |
| Actual gas                 | **100,000 MIST = 0.0001 SUI**, paid by sponsor; budget 2,000,000 MIST                                                           |
| Neon receipt               | `40d3c429-0b19-4c68-aa87-9726f3fb43b8`                                                                                          |
| Service result             | Contradictory recipient reference, `northstar-review.example` and bypass directive; hold for established-channel reconciliation |

Fresh Tatum native Mainnet gRPC confirms the chain genesis, execution, exact three balance changes and gas summary. The onchain BCS bytes equal the immutable approved preparation; the calculated prepared digest equals the actual executed digest. This does not make historical unsigned digests successful transactions. Persisted audit evidence contains challenge, approval, wallet request, exactly one settlement request, Tentacle response, confirmation and report completion. The original challenge is retained in Neon; an independent raw capture of the first browser's HTTP headers was not available.

Tentacle's response is not the success authority: Tatum merchant-credit verification and atomic Neon receipt/report persistence establish completion. Two authenticated resume requests returned the same saved receipt. No new signature or settlement was requested. Existing idempotency/replay/concurrency tests cover the code path separately from this real transaction.

The reported SuiVision **0.0009 SUI** is not the actual merchant balance change. The transaction independently shows +0.001 to Wallet B and -0.0001 to the separate sponsor. Although their difference is 0.0009, the exact reported explorer screen was not observed, so its display semantics remain unverified. Slush's 0.001 receipt matches the actual credit. Both payer and merchant are owner-controlled experiment accounts; no supplier payment or independent customer purchase is claimed.

[Complete read-only payment evidence](evidence/mainnet-service-reconciliation.json) · [repeated receipt and live recall evidence](evidence/payment-experiments-preparation.json).

## Remaining experiments

`X402-EXPERIMENT-02` is an open synthetic Northstar invoice with contradictory recipient text and a new linked billing domain. `X402-EXPERIMENT-03` is an open synthetic claimed payout/verification-policy change. Both are distinct from purchase 1 and easy to locate by invoice search or `?invoice=` in Agent Services. Each needs a fresh genuine HTTP 402, exact 0.001 SUI terms, explicit owner acceptance, separate Slush signature, one settlement submission, independent verification and saved report. No approval is inferred from this document.

Experiment 3's live non-spending comparison is complete: Memory OFF has zero citations and mandatory recipient/instruction holds; ON recalls **seven** confirmed owned records and adds independent-phone-channel verification and repeated-pattern escalation. Both remain **High risk / verification required**. This enriches the recommendation without inventing a risk-grade improvement or waiving the hold. The exact supplier policy blob includes `v8OD2R59cXEjANkoV5UY9HSIInE-SY1tOBzZY7uerYQ`; the original verification rule is `pPYsV-RKCESYlutuJDdc9lj9pxV2ixSA_zMHRDr2CM4`. All citation IDs/text and findings are recorded. Logout and a new authenticated session recalled a previously observed exact blob again. No distinct independently verified correction arose, so no duplicate memory was written.

**Actual settled total: one service purchase, 0.001 SUI merchant credit.** Experiment 2 digest/credit/report: pending owner signature. Experiment 3 digest/credit/paid report: pending separate owner signature. Prior cancelled/expired/prepared attempts and the self-deposit do not increase that total.

## Access and engineering

- **Visitor:** `/try`, seven synthetic steps with separately identified recorded Walrus/Tatum proof; no account or funds.
- **Member:** `/connect`, deliberate provider connection followed by free personal-message registration/login; automatic first profile, nonce verification, secure session and tenant authorization. Provider acceptance is required. Physical production provider compatibility remains unverified.
- **Owner:** `/app?signin=1`, existing private administrator password. Integration operations and supervised Mainnet service purchases remain administrator-only. Financial authorization is separate from login.

Agent Services now shows searchable named invoices, experiment identity, expected report, exact terms, preparation/signing/submission/finalization phases, actual merchant credit, readable saved results and explorer links. Session exposure includes unsettled reservations under the unchanged 0.003 SUI cap. New quote controls are unavailable while a saved intent is settling. A fresh financial purchase remains a deliberate owner action. No redesign, reset, wallet replacement, funding or conversion was performed.

[Slush investigation and unknowns](SLUSH_LOCALHOST_INVESTIGATION.md) · [validation ledger](TEST_RESULTS.md) · [judge instructions](JUDGE_WALKTHROUGH.md) · [written demo script](DEMO_SCRIPT.md). No video was created or recorded.
