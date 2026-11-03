# Nightly checkout diagnosis and recovery — November 2

The reported error came from a real administrator/customer session mismatch. Fresh read-only Neon inspection found the two recent attempts belonged to the **owner tenant**, with no authenticated member payer in their challenge. The latest was quoted, expired, never prepared, never signed/disclosed and never submitted. It was not a fourth payment. The three settled receipts and 32 confirmed memory identities remain intact.

Administrator checkout correctly requires the configured owner payer (`0xc0f3…397a8`). A connected personal Nightly account does not replace that administrator session. The server's member metadata already returns the authenticated customer's wallet; `checkoutPayer` also checks that member identity independently. The inspection found no evidence that member checkout was silently assigned the owner's payer. Whether the owner switched profiles, tabs or signed into the administrator afterward is not observable from these records.

## Targeted repair

- Agent Services names the active checkout identity and displays its exact expected payer before terms review.
- **Switch to wallet workspace** deliberately signs out the administrator and opens `/connect?next=/services`. The free wallet signature creates/returns a member session and returns directly to Agent Services. Only `/app` and `/services` return targets are accepted; arbitrary redirects are not permitted.
- Customer checkout requires the snapshot identity, server payer and quote-bound authenticated payer to agree. Owner checkout continues using the configured owner payer. Existing tenant-scoped server checks, frozen bytes, signatures, caps and settlement behavior are unchanged.
- Account matching compares canonical Sui addresses while retaining the provider's original account object for signing. It never selects a different payer merely because another account supports Mainnet.
- Errors distinguish administrator/personal mismatch, wrong signed-in member, empty account list, wrong network, missing financial-signing feature and stale session/quote identity. Free authentication is not treated as financial capability.

Official Nightly 1.51.49 package inspection advertises `sui:mainnet`, personal-message signing and transaction signing, including current Sui transaction serialization. This is package evidence, not proof of the owner's installed version or a successful financial signature. Owner-confirmed Production authentication remains valid evidence for login only.

## One direct owner entry action

On Production **Agent Services**, click **Switch to wallet workspace** if it says Administrator checkout. Select Nightly and complete the free personal-message sign-in. It returns to checkout with your authenticated payer. Use an unpaid synthetic invoice from that private member workspace; owner-only invoices are not imported or exposed. Request the exact 0.001 SUI quote and prepare it, then personally inspect any separate Nightly financial request before approving it.

No financial signature or settlement is performed by this repair. Existing expired owner quotes are preserved rather than automatically cancelled or reused. If a signature/submission has an uncertain result, resume that original intent instead of requesting another purchase. The established funding implementation supports address balance and the strictly validated owned-coin fallback; no conversion is requested automatically.

At **2026-11-02 22:18 UTC**, fresh Tatum Mainnet reads found the existing funded member at **0.012446622 SUI**, entirely address balance, matching the owner's approximate report. It already covers the 0.001 SUI price; no conversion or funding is requested. The complete Nightly address was a placeholder in the owner's message, so its provider association must still be confirmed against the exact payer displayed after Nightly sign-in. The full address remains in private local diagnostics, with only a fingerprint in the [public balance recheck](evidence/nightly-member-balance-recheck.json).

The **November 3, 08:46 UTC** Tatum handoff read reconfirmed that same **0.012446622 SUI address balance**, with no new service payment. Its current exact wallet association still requires the owner to compare the full payer in Nightly.

## Evidence and limits

The full unit/integration run passed 213 tests. The first comprehensive local browser run passed 38, failed one FAQ wording expectation, and skipped two deliberate live-provider specs. Restoring the explicit provider-stop guidance fixed that copy regression; the three affected public UX cases then passed. Owner/member preparation, alternate account rejection, direct return from free wallet authentication, replay protection, ordinary-coin preparation and tenant isolation passed with controlled fixtures. These do not certify a physical financial transaction.

The actual Production administrator-session switch/free entry passed separately. The checkout identity panel also passed 360/390/430px geometry at scale 1. The mobile run used HTTP/1.1 after transient WSL `ERR_NETWORK_CHANGED` and a Connect-load timeout; initial failures remain recorded. These checks did not connect an extension or request a financial signature. [Desktop switch](evidence/nightly-checkout-production-switch.json) · [mobile check](evidence/nightly-checkout-production-mobile.json).

Fresh independent reads reconfirmed all 32 Walrus provider jobs and all three Tatum Mainnet credits, exact prepared/executed digests and unchanged full receipt content. A new server process made **one** recall query for existing Experiment 3: OFF returned zero citations, ON seven; every baseline finding and both high-risk holds remained. The older learning evaluation's four queries are a separate metric. [Mainnet recheck](evidence/final-audit-mainnet-readonly.json) · [fresh recall](evidence/final-audit-fresh-recall.json).
