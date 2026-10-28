# Agent-service payments — implementation and settlement status

**Implemented and fixture-tested: controlled Sui Testnet x402 v2 flow. No real Testnet or Mainnet payment has settled through this feature. No bonus completion is claimed.**

The agent identifies instruction anomalies and requests a useful **first-party PayGuard consistency analysis**. The report checks contradictory recipient mentions, embedded link domains and injection directives, then recommends the required independent channel. It is deterministic supplemental analysis, not an external identity verification service or a third-party purchase.

## Flow and controls

1. An authenticated owner requests a quote for an invoice with instruction anomalies. The service responds HTTP **402**, `PAYMENT-REQUIRED`, x402 version 2, a resource URL and exact terms.
2. The only supported network is **Sui Testnet**. The fee/cap is **0.001 Testnet SUI / 1,000,000 atomic units**, paid to privately configured `SERVICE_PAYMENT_RECIPIENT`. No recipient default exists. The merchant must differ from payer and sponsor.
3. The UI displays network, asset, amount, recipient, purpose, five-minute expiry and facilitator gas budget of at most **2,000,000 MIST**. An explicit owner checkbox precedes wallet connection/signing.
4. A Sui wallet extension signs only a locally validated transaction. Keys stay in the wallet. The signature binds full Testnet genesis, exact destination/asset/amount, restricted commands, gas terms and the quote nonce. PayGuard never asks for a seed or spending key.
5. The server validates the same constraints and signer, then calls the pinned facilitator's `/verify`. It reserves the unique signed payload and digest atomically before `/settle`.
6. Tatum **Testnet** gRPC must independently confirm finalized successful execution, sender, exact positive merchant credit and coin. A facilitator response alone cannot create a receipt. Timeouts stay pending; resume checks the same digest without resubmitting payment.
7. A unique service receipt and frozen-input consistency result are persisted in separate Neon tables. Supplier invoice approval/status is unchanged. The report warns if instructions changed after the quote.
8. With explicit consent, a minimized vendor verification rule is stored through the existing resumable Walrus workflow. It contains no raw invoice/contact details. The result contributes guidance, never identity certification.

The authenticated `/services` page supports resuming saved pending/settled intents. Protected service APIs enforce origin, owner, tenant ownership, body limits, quotas, expiry, idempotency and replay prevention. The public judge sandbox exposes no service-payment controls.

## Verified provider compatibility

The [x402 Foundation Sui exact specification](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_sui.md) and [TentaclePay implementation](https://github.com/tentaclepay/sui-x402) informed the wire binding. The facilitator's actual `/supported` response advertised x402 v2 `exact` on `sui:testnet` and `sui:mainnet`. This app accepts only Testnet. The wallet transaction uses Sui `balance::send_funds`; the facilitator sponsors gas. The actual Testnet genesis was read as `69WiPg3DAQiwdxfncX6wYQ2siKwAe6L9BZthQea3JNMD`; Tatum Testnet also identified that genesis and checkpoint `400320637`. These are read-only compatibility checks, not settlement evidence.

The third-party SDK was evaluated and removed because its dependency graph introduced high-severity Zod findings. The retained binding uses the already patched Sui/Zod packages and a pinned facilitator with strict local validation. Final npm audit must remain clean. End-to-end compatibility, including the quote-nonce input and wallet support, remains unproven until the controlled funded-wallet test runs.

## Required owner setup and blockers

Set names privately: `ENABLE_AGENT_PAYMENTS` (controlled Testnet mode), `SERVICE_PAYMENT_RECIPIENT`, `TATUM_API_KEY`, `DATABASE_URL`, `APP_URL`, `AUTH_SECRET`, `OWNER_PASSWORD`. Walrus learning additionally uses the existing memory variables. Apply additive migrations `0002` and `0003`. Use a separate Testnet wallet with Testnet SUI/address-balance funds and a distinct merchant account; open `/services` after owner login. The wallet UI will request approval for the displayed Testnet terms. No automated funded-wallet experiment was performed here because those accounts are not configured.

**Mainnet is disabled in the network schema, browser path and server verifier.** `ENABLE_AGENT_PAYMENTS=mainnet` cannot enable it. Before any future Mainnet transaction, the owner must explicitly approve the exact amount, asset, recipient and purpose; a code/configuration review is also required. This implementation request does not constitute financial authorization.

Unit protocol and persistence tests use synthetic signed transactions and mocked facilitator/Tatum responses. They verify exact caps, wrong network/recipient/nonce rejection, explicit approval, cross-tenant denial, single settlement and timeout/resume. They are not onchain receipts. A genuine Testnet receipt and, only after separate exact authorization, a genuine Mainnet receipt are still needed for an award claim.
