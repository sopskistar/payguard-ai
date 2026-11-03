# Nightly account-selection repair — November 3, 2026

**A replacement payment or new financial signature is not safe yet.** The latest dual-provider read is epoch **1300**. The two earlier intents and two more recent customer preparations have `ValidDuring` bounds 1300–1301. Their expired application quotes do not revoke a possible signature. All four records and their reservations remain intact.

## Recovered state and confirmed cause

Local `main`, fetched `origin/main`, Production `/api/release` and the successful Vercel deployment matched `f27acd3ecd4d6651dc342962a13533ab960129fc`. Existing video work and its eight tracked modifications were preserved. This repair changes no dependency, migration, invoice, supplier, memory, Courtroom, receipt or public-demo implementation.

The warning **“Wallet account changed. Reconnect the exact approved payer before signing.”** was an application adapter-selection bug. The saved official Nightly 1.51.49 injection runtime registers **Solana, Sui, Aptos**, in that order, with a shared provider ID/name. Checkout correctly filtered for Sui during preparation, but its later `.find()` searched every registered wallet using only that shared ID. It selected the Solana adapter and checked its accounts for a Sui signer. That produced the warning even when the Sui account had not changed.

A local browser regression reproduces the exact warning against the previous deployed application bundle, before a local attempt marker or financial wallet call. The corrected test keeps the same registration order. This establishes the application defect; it does not establish the owner's currently installed extension version or physical signing acceptance. [Expected failure on the old bundle](evidence/nightly-adapter-reproduction.json).

The customer's saved workspace identity, quote-authenticated payer, recorded approved payer and prepared BCS sender agree. The selected account at preparation was checked against that payer. The current physical Nightly account/network cannot be read from server records; the owner must compare the new account check with Nightly's own UI. No account-switching evidence was found in the stored preparations. Their quotes are now expired, which is a separate signing restriction.

## Independent reconciliation

The [sanitized read-only evidence](evidence/nightly-account-reconciliation.json) includes Tatum and Sui full-node Mainnet genesis, epochs, checkpoints and retention lower bounds. Both endpoints cover the relevant recent history and return `NOT_FOUND` for all four prepared digests. No signed payload, execution digest or settlement submission is persisted for any of these intents.

| Intent                                 | Audience                          | Prepared digest                                |
| -------------------------------------- | --------------------------------- | ---------------------------------------------- |
| `544d939d-02d5-4d98-b549-69fb9fb501e8` | Earlier member preparation        | `EDe8JMezpxR4qpWFiMQni6ETMdYfYXiM8Sdxnkzvse3s` |
| `b0386342-a7c2-40ba-909e-9edf17501767` | Earlier administrator preparation | `7GiPuDNq1vN8pLn2cqJf8kYMrt9zmbdDBbAfdoYtGdRj` |
| `7a025238-06d9-43ca-8b5f-16ef7079f086` | Recent customer preparation       | `CcfxLSCtm6Nr6gZvLbif4dFYJTyt3ECCSDR4nMaQzGw6` |
| `d23937ed-1907-4e40-8156-488f453a921a` | Recent customer preparation       | `7dDdwa2iHbGkXsmrk5wKT3TerFoQ46hMtEDaxq8vFiJR` |

The administrator intent retains its original provider error. It cannot be attributed conclusively to a particular installed wallet from its saved fields. The two recent customer warnings match the reproduced failure before signing, and have no saved wallet-attempt event. Absence of server payloads is not proof that an unknown older attempt never produced a signature. No record was cancelled, marked failed or given a fabricated receipt.

Both providers confirm the customer's **12,446,622 MIST / 0.012446622 SUI**, entirely address balance. Both independently reconfirm all three original successful settlements, each with **1,000,000 MIST** merchant credit. Neon still has **33 confirmed memories, three receipts, three settlement submissions and zero settling intents**. The complete original receipt-content fingerprint is unchanged.

## Source changes and invariants

- [Wallet selection](../src/lib/service-wallet.ts) retains the exact prepared Sui provider object. Signing requires that same object to remain registered, Mainnet and current signing capabilities to remain available, and the live account to match the authenticated, quoted and approved payer. A recreated account object for the same canonical address is accepted without constructing a replacement account.
- [Checkout](../src/components/service-payment.tsx) calls the current provider's `sui:signTransaction` with the live original account and frozen approved BCS bytes. Returned-byte, expected-signer and cryptographic server checks remain. No sign-and-execute or legacy fallback was added. Provider events update the displayed connected accounts.
- **Check selected wallet account · no signing** connects only the chosen Sui provider and checks the exact payer. It does not create a quote, prepare a transaction, approve payment, sign or submit. It remains available while an expired payment is held. The optional Slush shortcut is not part of the Nightly workflow.
- [Server recovery holds](../src/lib/service-payments.ts) prevent a new Mainnet quote, competing preparation or signed-payload submission while another owned prepared/submitted attempt remains unresolved. Mainnet preparations serialize on the authenticated user row across browser sessions. An application expiry or missing diagnostic cannot release a prepared Mainnet reservation. Existing submitted-intent reconciliation and saved receipts remain accessible.
- The [authenticated payment route](../src/app/api/service-payments/[[...path]]/route.ts) exposes only owned recovery IDs and recorded payers. Holds also prevent a reported decline from authorizing a retry while another attempt is unresolved. No historical payment record or spending reservation was modified by this repair.

The current [Mysten signing API](https://sdk.mystenlabs.com/dapp-kit/actions/sign-transaction) supports frozen BCS input, and the [Sui Wallet Standard](https://www.docs.sui.io/onchain-finance/asset-custody/wallets/wallet-standard) separates signature-only approval from execution. Compatibility tests are fixtures/offline checks, not physical Nightly acceptance. The older `Invalid type` provider exception is not newly certified as resolved by this adapter repair.

## Safe owner actions now

1. In Nightly, confirm Sui Mainnet and the full intended account ending **c42365fa**. Preserve any pending-transaction history; do not approve a financial prompt.
2. In the existing private workspace, open Agent Services for the existing synthetic invoice. If needed, resume its saved approved intent. Do not recreate a supplier, invoice or payment.
3. Choose **Nightly** under **Signing wallet**, then click **Check selected wallet account · no signing**. A connection permission may appear; no financial signature is requested. Compare the connected signing account, authenticated workspace wallet, expected payer, quote payer and recorded payer. They must agree in full.
4. Leave the recovery hold and existing intents in place. Do not clear local attempt markers or use cancellation to free their reservations.

Before any new financial test, independently recheck all four exact digests and the current epoch. If signature evidence cannot resolve an older attempt, the conservative lifetime checkpoint is **strictly later than epoch 1301 — epoch 1302 or above**. Then reconcile any finalized outcome and safely resolve the old reservations under audited server policy. No automatic lifetime-based release is implemented, and epoch advancement alone does not prove a past payment never executed.

Only after that review resolves every hold: reuse the existing unpaid invoice, request one fresh 0.001 SUI Mainnet quote, choose Nightly, check the exact account, review recipient/sponsor/expiry, accept the exact terms, click **Review 0.001 SUI purchase · prepare**, inspect its digest/bytes, and personally click **Sign and submit in wallet** once. Only the owner can approve the physical Nightly prompt. A failure or uncertain response requires resuming that same intent. Success requires independent finalized exact credit and the saved receipt/report; reopening the receipt must not charge again.

## Validation

All **224 unit/integration tests** passed. The complete disposable-database browser run passed **47 tests, zero failures/flakes, and two deliberate live-provider skips**, including the formerly failing Nightly case, account switching/network/disconnect checks, fresh account-object handling and an expired-payment connection check with no purchase. [Actual browser results](evidence/nightly-account-selection-browser.json).

TypeScript, formatting and the production build passed. Lint has zero errors and one pre-existing unused-import warning in an untracked video script. The initial restricted build/loopback startup failed on sandbox permissions; the standalone type check also raced build-generated types, so build and type checking were completed sequentially. The first new regression needed an explicit preparation wait; after that correction it reproduced the original exact warning against the old bundle. No application failure remains in the final regression results. [Validation ledger](evidence/nightly-account-validation.json).

Deployment is independently established by the Production `/api/release` SHA and GitHub's Vercel status, not by these local tests. Physical Nightly financial acceptance remains blocked by the unresolved earlier attempts. No additional financial signature or settlement was performed.
