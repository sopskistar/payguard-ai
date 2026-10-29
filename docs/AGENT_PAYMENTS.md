# Sui Mainnet x402 service payments

**Mainnet and development Testnet are implemented. No genuine service payment has settled on either network. Hosted wallet signing remains security-paused. The payments bonus is unproven.**

PayGuard offers a useful, explicitly **first-party** consistency analysis when supplier instructions show anomalies: conflicting recipient mentions, embedded link domains and instruction-bypass language. The report preserves independent human verification and cannot approve or pay a supplier invoice. Buyer and merchant may both be controlled by this project; this is not an independent identity check.

## Verified non-spending compatibility

The pinned facilitator is `https://facilitator.tentaclepay.com`. Its actual `/supported` response advertises x402 v2 `exact` for `sui:mainnet` and `sui:testnet`, a sponsor address and a 2,000,000 MIST gas budget. [Mainnet preflight](evidence/mainnet-service-preflight.json) independently checks chain identity and native SUI metadata through Tatum. Advertised support is not settlement evidence.

| Term                           | Enforced value                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| Primary network                | `sui:mainnet`                                                                                   |
| Mainnet genesis                | `4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S`                                                  |
| Development network/genesis    | `sui:testnet` / `69WiPg3DAQiwdxfncX6wYQ2siKwAe6L9BZthQea3JNMD`                                  |
| Asset                          | Native SUI, `0x2::sui::SUI`, 9 decimals                                                         |
| Exact service price            | **0.001 SUI = 1,000,000 MIST**                                                                  |
| Authenticated session cap      | **0.003 SUI = 3,000,000 MIST**, including pending reservations                                  |
| Sponsor budget / payer gas cap | **2,000,000 MIST / 0 MIST**                                                                     |
| Merchant                       | Separately controlled, canonical nonzero `SERVICE_PAYMENT_RECIPIENT`                            |
| Mainnet payer                  | Dedicated, separately controlled `SERVICE_PAYMENT_PAYER`; must differ from merchant and sponsor |
| Quote validity                 | Five minutes, quote UUID and frozen instruction hash                                            |

The native-SUI sponsored path requires **Sui address-balance funds**. Coin-object holdings alone do not satisfy it. The browser checks address balance and explicitly redeems the exact withdrawal before sending the resulting balance, matching the [Sui framework function types](https://github.com/MystenLabs/sui/blob/main/crates/sui-framework/packages/sui-framework/sources/balance.move). It cannot silently select other objects. PayGuard does not deposit funds, request a key, sign automatically, or fund a service. Any preparatory real-value action also needs explicit approval.

Sources: [Foundation exact Sui specification](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_sui.md), [Tentacle implementation](https://github.com/tentaclepay/sui-x402), [facilitator docs](https://docs.tentaclepay.com/x402/facilitator). No third-party payment SDK was installed. The alternative [DrVelvetFog facilitator](https://github.com/DrVelvetFog/sui-x402-facilitator) was evaluated: its public support response advertises both networks but lacks the selected sponsor terms; its documented sender-paid/USDC and legacy-RPC approach is not a drop-in replacement for this binding. This is a compatibility assessment, not a security certification of either provider.

## Implemented workflow and boundaries

1. An authenticated administrator selects an owned invoice with an actual instruction anomaly. Ordinary wallet members cannot access this spending pilot.
2. The first-party resource issues an authentic HTTP 402 with base64 `PAYMENT-REQUIRED`. The browser checks version, origin, exact resource/quote ID, sole accepted requirement, header/body equality, network, asset, amount, recipient, sponsor and expiry.
3. `/services` displays the provider, purpose, service URL, network, asset, exact amount, payer, recipient, facilitator, gas terms and session cap. Consent is separate from wallet signing. Read-only preflight works while settlement is disabled.
4. In a security-cleared environment with spending explicitly enabled, an expressly selected compatible Wallet Standard wallet supplies the dedicated account. Network genesis and sufficient address balance are checked before reserving approval.
5. A server-derived authenticated-session budget is locked transactionally. Approval is idempotent; concurrent requests cannot exceed the cap. No client-submitted session/tenant ID is trusted. Unsubmitted cancellation releases its reservation; pending, failed and settled attempts remain conservatively counted.
6. The wallet signs complete BCS bytes only after explicit terms approval. Local and server checks enforce exact sender/merchant/SUI withdrawal, network genesis, restricted framework commands, no arbitrary objects or sponsor-gas spending, quote nonce, sponsor owner/budget and bounded validity. Changed wallet bytes are rejected.
7. The signed v2 payload travels in `PAYMENT-SIGNATURE`. The pinned facilitator's `/verify` must accept it and match the payer. A unique digest/payload is claimed atomically before the single `/settle` attempt. Redirects are rejected. No automatic settlement retry occurs after a lost response.
8. Tatum's network-specific TLS gRPC independently checks full genesis, finalized success, digest, sender, exact positive merchant credit, coin type and sponsor. Facilitator responses are audit evidence, never authoritative receipts. Uncertain attempts stay pending; resume only checks the original digest. Finalized failed execution receives no service receipt or replacement payment.
9. A unique receipt and actual frozen-input analysis result are persisted atomically in Neon. Changed instructions invalidate applicability. Only owned, settled, current-instruction reports appear as informational review evidence; they cannot remove approval holds.
10. A separate explicit consent permits an appropriately minimized Walrus learning record after confirmed settlement. No automatic memory write or supplier payment is performed.

Approval, replay, malicious challenges, Mainnet/Testnet separation, concurrency, cancellation, failure, ambiguous settlement, stale results and cross-tenant boundaries are covered by protocol, store and settlement tests. Their facilitator/Tatum settlement responses are **mocks**, not onchain receipts.

## Configuration and exact authorization still required

Existing private server configuration: `DATABASE_URL`, `AUTH_SECRET`, `OWNER_PASSWORD`, `APP_URL`, `TATUM_API_KEY`. Walrus uses the existing `MEMWAL_ACCOUNT_ID`, `MEMWAL_PRIVATE_KEY`, `MEMWAL_SERVER_URL`. Apply additive migration `0006` for durable spending sessions; existing records are preserved.

Additional names: `ENABLE_AGENT_PAYMENTS`, `SERVICE_PAYMENT_PAYER`, `SERVICE_PAYMENT_RECIPIENT`, `SERVICE_PAYMENT_SETTLEMENT_ENABLED`. Quote mode supports `mainnet` and controlled development `testnet`; the independent settlement switch defaults to false. **Keep production settlement disabled.** No environment variable bypasses the unresolved Slush gate.

The latest preflight is incomplete because the dedicated payer and merchant addresses are not configured. Provide public addresses only or configure those names privately. Once configured, prepare the exact approval record with payer, merchant, first-party provider/service URL, Mainnet genesis, SUI coin type, 0.001 SUI price, zero payer gas, sponsor identity/2,000,000 MIST budget, purpose, expected report and facilitator risks. Obtain separate owner approval and resolve the production wallet-security review before a funded signature or settlement. Building Mainnet support is not financial authorization.

Read-only command (does not enable spending):

```bash
node --conditions=react-server --import tsx scripts/service-preflight.ts --origin=https://payguard-ai-henna.vercel.app --publish
```

No genuine digest, successful paid result or receipt exists yet. End-to-end physical-wallet compatibility, sponsored execution and the bonus remain unproven until the specifically authorized transaction succeeds and Tatum independently confirms it.
