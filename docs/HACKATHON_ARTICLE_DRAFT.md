# The invoice was familiar. The recipient was not.

*Draft: add verified proof and deployment links before publication. This draft does not claim completed Mainnet acceptance.*

A payment request can look routine while changing the one detail that matters: who gets paid. The FBI's [business email compromise guidance](https://www.fbi.gov/how-we-can-help-you/common-frauds-and-scams/business-email-compromise) describes vendor impersonation, subtle address changes and compromised correspondence. It recommends independently verifying changes using a known channel. PayGuard Verify turns that review practice into an observable workflow.

## Start with a reference, not a score

The application records a vendor's established recipient, email domain and independent contact. A new instruction is compared against that reference. Changed recipients, mismatched reply-to details, urgency and instructions to skip verification become explicit findings. We do not call the resulting rule score a fraud probability. A matching email domain does not authenticate a message, and a syntactically valid wallet does not prove supplier control.

## The human establishes the fact

A reviewer contacts the supplier through the previously established channel and records what happened. The attestation is bound to an instruction snapshot and vendor-profile revision. Editing either invalidates it; concurrent edits and approvals use database row locks. These records are human assertions, not claims that our app observed a phone call. No supplier payment is initiated.

## Walrus remembers why

Corrections become minimized policy templates with pseudonymous references. Raw invoice documents, correspondence, contacts and detailed explanations are not sent to Walrus. The server uses the Walrus Memory delegate SDK, records an accepted job ID durably, and waits for a completed result before showing a confirmed blob. A timeout remains pending and resumes the same job.

When a later invoice is reviewed, semantic recall queries the owner's stable namespace. Returned content is untrusted until it matches the exact confirmed tenant-owned payload. The deterministic engine then applies the matching authoritative policy, with a visible citation. Memory OFF removes learned soft-policy application while retaining mandatory checks. An empty recall result produces no invented improvement.

**Insert actual cross-session experiment:** baseline finding, correction, completed job/blob IDs, fresh-session recall response, cited finding difference, and measured timestamps. Include at least ten distinct completed memories. Until then this describes the implementation, not a proven live result.

## Tatum supplies a different kind of evidence

The backend uses native Sui Mainnet gRPC through Tatum, with TLS and a server-only API key. It verifies service identity, fetches transaction effects and balance changes, resolves coin decimals, and compares exact atomic units. Gas-payer rebates are excluded from payment matching. Fiat invoices need an explicitly agreed token amount. Database uniqueness protects against digest reuse.

This chain evidence answers whether the expected address received the expected token amount. It does not answer whether the supplier authorized the instruction. Keeping those questions separate is central to the product.

**Insert real Tatum evidence:** service/checkpoint result, actual public transaction digest and validation outcome. Do not paste private contacts, credentials or full invoice details.

## What we tested and what remains

The automated suite covers attack replay controls, changed-recipient gates, stale human verification, parsing, reconciliation edge cases and durable memory state transitions. Provider fixtures are explicitly synthetic. Local PostgreSQL tests establish application behavior, not Neon or Mainnet connectivity. Live deployment and fresh-session learning must be demonstrated separately.

Memory is subject to retention epochs and semantic indexing delays. Deterministic patterns can miss attacks or flag legitimate requests. Our audit is append-only through the app, not immutable against a database administrator. These limits remain visible rather than hidden behind a confidence badge.

**Before publishing:** replace this status paragraph with verified outcomes, add genuine screenshots and live/repository links, link the completed proof ledger, and review all exported identifiers. No x402/MPP settlement or payment bonus is claimed.
