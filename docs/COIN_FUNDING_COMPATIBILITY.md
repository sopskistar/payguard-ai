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

## Funded member’s next controls

The latest owner message confirms Nightly Production login but contains `[PASTE COMPLETE NIGHTLY ADDRESS HERE]` instead of an address. The matching recently registered account ending `c42365fa` has 12,446,622 MIST in address balance as of the [fresh read](evidence/nightly-funding-read.json). Its exact association with the owner’s Nightly wallet still needs confirmation; it is not treated as an authorized payer merely because the rounded balance matches.

Once confirmed, use the already signed-in private workspace. **Vendor Trust → Create supplier** can add a clearly synthetic supplier. In **Invoice Inbox**, create an unpaid invoice named `NIGHTLY-PRODUCTION-01` if unused and label its memo synthetic. Include meaningful contradictory instructions for the supplemental analysis. A synthetic supplier recipient is distinct from the real service merchant; purchasing analysis does not pay that supplier. New accounts have no learned policies, so Memory ON can correctly return zero citations until a separately authorized memory is confirmed. The public Courtroom’s seven recorded citations are not imported into a private member account.

In **Agent Services**, select that invoice, click **Check Mainnet proposal · no signing**, then **Request payment quote**. Review the exact terms and purchase-consent checkbox, select Nightly, and click **Review 0.001 SUI purchase · prepare**. Preparation is unsigned and freezes the transaction. Only then click **Sign and submit in wallet** for the owner personally to inspect and approve in Nightly. The terms must show 1,000,000 MIST to `0x99eac0f7be358adf9f96ce0490392f356332af96376aadf11d829a529c1a189e`, Mainnet, the confirmed member payer and Tentacle sponsor `0x6d8c6e978808e81344b6ddcc741b06d2b2b1106066d218683e0161f696878b61`, with zero payer gas. No fresh quote was created on behalf of an unconfirmed member address during this work.
