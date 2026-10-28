# The invoice was familiar. The recipient was not.

_Draft: add verified proof and deployment links before publication. This draft does not claim completed Mainnet acceptance._

A payment request can look routine while changing the one detail that matters: who gets paid. The FBI's [business email compromise guidance](https://www.fbi.gov/how-we-can-help-you/common-frauds-and-scams/business-email-compromise) describes vendor impersonation, subtle address changes and compromised correspondence. It recommends independently verifying changes using a known channel. PayGuard Verify turns that review practice into an observable workflow.

## Start with a reference, not a score

The application records a vendor's established recipient, email domain and independent contact. A new instruction is compared against that reference. Changed recipients, mismatched reply-to details, urgency and instructions to skip verification become explicit findings. We do not call the resulting rule score a fraud probability. A matching email domain does not authenticate a message, and a syntactically valid wallet does not prove supplier control.

## The human establishes the fact

A reviewer contacts the supplier through the previously established channel and records what happened. The attestation is bound to an instruction snapshot and vendor-profile revision. Editing either invalidates it; concurrent edits and approvals use database row locks. These records are human assertions, not claims that our app observed a phone call. No supplier payment is initiated.

## Walrus remembers why

Corrections become minimized policy templates with pseudonymous references. Raw invoice documents, correspondence, contacts and detailed explanations are not sent to Walrus. The server uses the Walrus Memory delegate SDK, records an accepted job ID durably, and waits for a completed result before showing a confirmed blob. A timeout remains pending and resumes the same job.

When a later invoice is reviewed, semantic recall queries the owner's stable namespace. Returned content is untrusted until it matches the exact confirmed tenant-owned payload. The deterministic engine then applies the matching authoritative policy, with a visible citation. Memory OFF removes learned soft-policy application while retaining mandatory checks. An empty recall result produces no invented improvement.

On October 28 we confirmed all twelve distinct seeded policies on Walrus Mainnet. These are fictional business events with real storage receipts. The first seed's job was `4d590890-db79-4329-986f-10f52d32d5c7`, returning blob `pPYsV-RKCESYlutuJDdc9lj9pxV2ixSA_zMHRDr2CM4`. Interrupted writes resumed their accepted IDs; no pending job entered the confirmed count.

A new server process reviewed a later Northstar sample invoice at `2026-10-28T14:06:45.669Z`. OFF retained recipient-change warnings. ON retrieved twelve confirmed memories and applied three matching vendor policies, moving the review from “Needs review” to “High risk / verification required.” The proof file records the exact returned citations; this was not a local policy lookup dressed as recall.

A separate browser experiment then created a thirteenth confirmed memory, logged out, closed the first context, signed in through a new context, and reviewed a later invoice. The test passed in 56.8 seconds: the new assessment cited the exact blob written in the first session. Neither OFF nor ON bypasses the independent-verification gate. [Completion and recall evidence](MAINNET_PROOF.md) includes all thirteen job/blob pairs.

## Tatum supplies a different kind of evidence

The backend uses native Sui Mainnet gRPC through Tatum, with TLS and a server-only API key. It verifies service identity, fetches transaction effects and balance changes, resolves coin decimals, and compares exact atomic units. Gas-payer rebates are excluded from payment matching. Fiat invoices need an explicitly agreed token amount. Database uniqueness protects against digest reuse.

This chain evidence answers whether the expected address received the expected token amount. It does not answer whether the supplier authorized the instruction. Keeping those questions separate is central to the product.

Tatum identified Sui Mainnet as `35834a8a` and reported service checkpoint `339079915`. We inspected the real public digest `os1iG8zow278c6hqxbuyxnvMUjzThsD8GTY8atdfzW6`, finalized in checkpoint `339078672`. Its successful execution did not prove a payment to our sample vendor: the transaction showed a SUI debit from its sender, while the sample recipient received zero. Live coin metadata returned nine decimals. Our reconciliation returned **Mismatch** against the synthetic expectation of `500000000000` atomic units.

That negative result is useful. A successful transaction pasted into a review must not become a fabricated receipt. No transfer was sent and no invoice was marked paid. Positive matching remains covered by synthetic fixtures; this article makes no claim of a real positive supplier payment. Tip discovery was intermittent, so the demo uses the actual known digest with honest provider failures.

## What we tested and what remains

The automated suite covers attack replay controls, changed-recipient gates, stale human verification, parsing, reconciliation edge cases and durable memory state transitions. Provider fixtures are explicitly synthetic. Local PostgreSQL tests establish application behavior, not Neon or Mainnet connectivity. Fresh-session learning was demonstrated separately with live credentials; hosted deployment validation is recorded independently in the test ledger.

Memory is subject to retention epochs and semantic indexing delays. Deterministic patterns can miss attacks or flag legitimate requests. Our audit is append-only through the app, not immutable against a database administrator. These limits remain visible rather than hidden behind a confidence badge.

The narrow MVP deliberately uses a single active supplier reference with invoice-scoped attestations, rather than claiming a complete vendor identity system. The replay includes changed recipients, lookalike domains, compromised threads, a negative control, duplicates, legitimate exception context and the exact prompt-injection phrase from our adversarial test. New exception memories require a current independent attestation, remain invoice-scoped and expire after thirty days.

![Instruction comparison](screenshots/verification.png)

The remaining submission work is a verified public deployment, publication of this article to the chosen blog platform, a short recorded demonstration, and the required account/dashboard details. The repository contains the application, reproducible checks and reviewed real evidence. No x402/MPP settlement or payment bonus is claimed.
