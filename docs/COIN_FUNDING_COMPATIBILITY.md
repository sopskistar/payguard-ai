# Ordinary SUI checkout — November 2, 2026

The interrupted release required address-balance funds even when an authenticated wallet held ordinary SUI coins. This was a PayGuard template limitation, not a wallet refusal or a fundamental Tentacle restriction.

The fallback keeps the previously settled address-withdrawal template when sufficient. Otherwise it selects at most 16 owned native-SUI coins from at most four 50-item pages, merges if necessary, splits exactly 1,000,000 MIST, converts only that payment coin to a Move balance, and calls `balance::send_funds` to the configured merchant. The original coin change remains owned by the payer. Mixed funding withdraws only the shortfall from the payer's address balance. There is no separate self-deposit, automatic transfer, or modification of signed bytes.

Before approval, the server independently checks current Tatum coin type, owner, version, digest, balance and the minimum address withdrawal. The local validator reconstructs the entire permitted command/input template. Sponsor gas cannot be used as a payment coin. Existing quote, authenticated payer, network genesis, nonce, epoch expiry, frozen prepared bytes, financial signature, one-time settlement, receipt and spending-cap checks remain in place. Highly fragmented wallets can receive a specific insufficient-usable-funds error even if their aggregate is sufficient; no consolidation is performed automatically.

## Independently observed compatibility

[Unsigned Mainnet evidence](evidence/coin-funding-unsigned-mainnet.json) records a successful Tatum simulation with checks enabled and no mocked gas payment. It used an existing **public coin-holder discovered from public transactions**, not a wallet controlled or impersonated by PayGuard. No private key or signature was available or created. It is a dry run, not a fourth purchase.

- Exact merchant credit: 1,000,000 MIST.
- Payer deduction: 1,000,000 MIST.
- Sponsor net gas in this simulation: 100,099 MIST.
- Hosted Tentacle `/verify`: HTTP 200, `isValid: true`, with an empty, non-authorizing signature.
- `/settle` calls: zero. Signatures: zero. Persistent payment intents created by this probe: zero.

Only the single-coin fallback was exercised against Mainnet. Merge and mixed-balance cases have serialized-transaction and ownership-validation tests; physical funded fallback settlement remains unverified. The three historical purchases prove the unchanged address-balance path. Fresh reads found the likely funded Nightly account already has sufficient address balance, so its purchase should use that established path after the owner confirms its address.

## Primary sources

- [Tentacle pinned verifier source](https://github.com/tentaclepay/sui-x402/blob/843223cb9f4cfb92095cdaf285a201ea4ac13df8/typescript/src/exact/facilitator/send-funds.ts): accepts `SplitCoins → coin::into_balance → balance::send_funds` and exact amount/recipient/sponsor terms.
- [Tentacle pinned verification/settlement implementation](https://github.com/tentaclepay/sui-x402/blob/843223cb9f4cfb92095cdaf285a201ea4ac13df8/typescript/src/exact/facilitator/scheme.ts): simulation and settlement are separate operations.
- [Sui SDK coins and balances](https://sdk.mystenlabs.com/sui/transactions/coins-and-balances). PayGuard uses explicit owned coin references rather than the generic resolver, to retain change as coins and avoid an implicit self-deposit.

## One owner-approved Nightly purchase

Use Production `/connect`, choose Nightly and sign only the free authentication challenge. Confirm the authenticated account is the funded wallet. In its private workspace create a clearly synthetic supplier and unpaid invoice, include a contradictory recipient or suspicious instruction, review it, then open Agent Services. Click **Check Mainnet proposal · no signing**, **Request Quote**, then the displayed purchase-review control. Confirm 0.001 SUI, Mainnet, your payer, the configured merchant and sponsor. Prepare only those reviewed terms. **Sign in Wallet** must open Nightly for the owner personally to inspect and approve. Never paste keys or use the administrator password. If a response is uncertain, use **Verify Existing Payment** on that same intent; do not create another purchase.

No Nightly financial signature or fourth settled receipt has been verified by this repair. A prepared digest is not a transaction result.
