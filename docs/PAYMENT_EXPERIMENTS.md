> November 2: the three settled experiments below remain unchanged. One additional 0.001 SUI Nightly customer purchase is requested but **not signed, submitted or settled**. The owner’s address field contained a placeholder; exact payer confirmation and the owner’s separate Nightly approval remain pending. Fresh read found 0.012446622 SUI on the matching candidate account, entirely address balance, with no conversion required. [Read-only evidence](evidence/nightly-funding-read.json) · [next controls](COIN_FUNDING_COMPATIBILITY.md#funded-members-next-controls).

# Three verified Mainnet x402 purchases

Verified 2026-11-01T12:37:34.178Z through authenticated Tatum Sui Mainnet gRPC and persisted Neon records.

| Experiment / invoice       | Finalized Mainnet transaction                                                                                              | Checkpoint | Merchant credit | Payer gas / sponsor gas |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------- | ----------------------- |
| 1 · X402-OWNER-20261031-01 | [68bhHRKzrQang8xohsahBQbehoZ4SjApQJ1U1Wf2ppyx](https://suivision.xyz/txblock/68bhHRKzrQang8xohsahBQbehoZ4SjApQJ1U1Wf2ppyx) | 340211024  | 0.001 SUI       | 0 / 0.0001 SUI          |
| 2 · X402-EXPERIMENT-02     | [xASYnWVeftLraQ2RvxMR6oPndU3r7UoBrX9Z9KPJd9r](https://suivision.xyz/txblock/xASYnWVeftLraQ2RvxMR6oPndU3r7UoBrX9Z9KPJd9r)   | 340470114  | 0.001 SUI       | 0 / 0.0001 SUI          |
| 3 · X402-EXPERIMENT-03     | [4NxNL1sekFUNxpiu6ebhTtwdkT5UXnsiMsnhcPNK1tGA](https://suivision.xyz/txblock/4NxNL1sekFUNxpiu6ebhTtwdkT5UXnsiMsnhcPNK1tGA) | 340478705  | 0.001 SUI       | 0 / 0.0001 SUI          |

**Three settled receipts, three delivered reports, total 3,000,000 MIST / 0.003 SUI.** All payer/merchant accounts belong to the developer; the invoices are synthetic. No new payment was initiated to perform this audit.

## Experiment 1: X402-OWNER-20261031-01

Quote/intent: `51d204df-71fd-44a6-ac4a-c8e0c50b4cf5`. Receipt: `40d3c429-0b19-4c68-aa87-9726f3fb43b8`. Successful checkpoint 340211024. Merchant credit 1000000 MIST; payer debit 1000000 MIST and zero gas; sponsor gas 100000 MIST. Original x402 v2 exact challenge, approval, frozen bytes, signature/submission events, facilitator/Tatum confirmation and report provenance are linked in the reconciliation artifact. Exactly 1 settlement submission was recorded.

Delivered report: Hold: reconcile contradictory recipient references through the established supplier channel. The mandatory supplier hold remains independent.

## Experiment 2: X402-EXPERIMENT-02

Quote/intent: `d31d1a52-b0b3-4c5c-ba82-5902c5eaef4f`. Receipt: `ce6ea6a2-f13f-4c56-af79-3ec5c7a110db`. Successful checkpoint 340470114. Merchant credit 1000000 MIST; payer debit 1000000 MIST and zero gas; sponsor gas 100000 MIST. Original x402 v2 exact challenge, approval, frozen bytes, signature/submission events, facilitator/Tatum confirmation and report provenance are linked in the reconciliation artifact. Exactly 1 settlement submission was recorded.

Delivered report: Hold: reconcile contradictory recipient references through the established supplier channel. The mandatory supplier hold remains independent.

## Experiment 3: X402-EXPERIMENT-03

Quote/intent: `4a4d6014-5e9e-430d-8bcb-dad596733876`. Receipt: `ded5c799-ccc3-4c64-b813-34093325ecb1`. Successful checkpoint 340478705. Merchant credit 1000000 MIST; payer debit 1000000 MIST and zero gas; sponsor gas 100000 MIST. Original x402 v2 exact challenge, approval, frozen bytes, signature/submission events, facilitator/Tatum confirmation and report provenance are linked in the reconciliation artifact. Exactly 1 settlement submission was recorded.

Delivered report: Hold: reconcile contradictory recipient references through the established supplier channel. The mandatory supplier hold remains independent.

[Full approved/executed byte and balance evidence](evidence/mainnet-service-reconciliation.json) · [Repeated receipt reads and fresh recall](evidence/courtroom.json).

The 0.0009 SUI summary is not the actual merchant credit. Full effects show 0.001 credited to the merchant and a separate 0.0001 sponsor gas charge. The exact original explorer display aggregation was not observed; no hidden merchant fee is established.

Prepared/expired/cancelled attempts and the earlier self-deposit are not service purchases. Their historical audit remains in [PAYMENT_ATTEMPTS](PAYMENT_ATTEMPTS.md). Public optional checkout and its limits are documented in [README](../README.md).
