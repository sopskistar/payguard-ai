# Mainnet service purchase — approval worksheet (not authorized)

Both owner wallets already exist. Configure their public addresses using [Payment Setup](PAYMENT_SETUP.md); do not create replacements. The actual application expects `ENABLE_AGENT_PAYMENTS=mainnet` for non-spending quote mode, after readiness checks, and `SERVICE_PAYMENT_SETTLEMENT_ENABLED=false` throughout setup. Neither is financial approval. Fresh receipt-count audit: **zero** ([read-only recovery evidence](evidence/session-recovery-audit.json)).

**Not ready for funded signing. No service payment has settled.** This document grants no spending permission. The public Slush review connection cannot sign or authenticate, and cannot reach payment settlement.

| Exact term                         | Prepared value / unresolved item                                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Network                            | `sui:mainnet`                                                                                                                                                                  |
| Genesis                            | `4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S`                                                                                                                                 |
| Payer public address               | Missing `SERVICE_PAYMENT_PAYER`; dedicated, low-value, owner-controlled address required                                                                                       |
| Merchant public address            | Missing `SERVICE_PAYMENT_RECIPIENT`; separately controlled, nonzero, distinct from payer and sponsor                                                                           |
| Provider                           | PayGuard Verify **first-party** invoice-consistency analysis; not an independent identity-verification provider                                                                |
| Service origin                     | `https://payguard-ai-henna.vercel.app`; exact `/api/service-payments/<quote UUID>` resource is created from an owned invoice and frozen instructions                           |
| Asset / decimals                   | Native SUI, `0x2::sui::SUI`, 9 decimals                                                                                                                                        |
| Exact price                        | **0.001 SUI = 1,000,000 MIST**                                                                                                                                                 |
| Session exposure cap               | **0.003 SUI = 3,000,000 MIST**, including disclosed signatures and pending reservations                                                                                        |
| Facilitator                        | Pinned `https://facilitator.tentaclepay.com`                                                                                                                                   |
| Sponsor                            | `0x6d8c6e978808e81344b6ddcc741b06d2b2b1106066d218683e0161f696878b61`                                                                                                           |
| Sponsor gas budget / payer fee cap | 2,000,000 MIST sponsor budget; **0 MIST payer gas**; any changed sponsorship terms must be rejected                                                                            |
| Purpose                            | Inspect contradictory recipient mentions, link domains and instruction-bypass language in the selected anomalous invoice                                                       |
| Expected result                    | Real deterministic report bound to the frozen input; never “supplier verified,” and never automatic approval                                                                   |
| Success evidence                   | Actual digest, final successful Sui Mainnet execution, exact merchant SUI credit, independent Tatum reconciliation, returned service report, owned persisted receipt and audit |
| Memory                             | Optional separate consent to save a minimized relevant rule after a verified receipt; never a raw invoice                                                                      |

## Remaining security and financial boundary

1. The Slush warning is unresolved. Use the public `/connect` **review-only** selector to reach Slush’s own **Flag for review**, without approving the connection. Loading a selector is not clearance. No alternate wallet/domain may be used to evade the warning.
2. Configure the dedicated **public** payer and merchant in the server environment, then regenerate and inspect the quote. No private key or seed phrase belongs in the environment, repository or chat. SUI address-balance funds are required; coin-object holdings alone do not satisfy the selected sponsored path. Funding or conversion is itself a separate real-value action requiring approval.
3. Inspect the exact quote URL, invoice purpose, addresses, transaction commands, network, sponsor and fees. The five-minute application quote is not revocation of a disclosed signature: the chain validity window extends through the next epoch.
4. Only after legitimate security clearance and a controlled physical-wallet retest, obtain owner approval of the complete exact proposal. Keep `SERVICE_PAYMENT_SETTLEMENT_ENABLED` disabled until then. The existing hosted gate has no environment bypass.
5. Verify and settle once after authorization; ambiguous provider responses remain indeterminate and reserve the cap. Never retry settlement automatically. Only genuine settled execution and the actual delivered result can support the payment-bonus claim.

The first-party buyer/seller relationship, signed-byte disclosure risk, facilitator availability and unproven funded compatibility must be disclosed before consent. Current `/supported` and Tatum reads are **non-spending compatibility checks**, not a provider security certification or settlement proof. See [implementation controls](AGENT_PAYMENTS.md) and [dated preflight](evidence/mainnet-service-preflight.json).
