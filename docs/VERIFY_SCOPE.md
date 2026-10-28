# PayGuard Verify scope and specification status

The owner requested continuation/refocus on October 27, 2026. The existing Next.js app, schema/migration, auth, review engine and adapters were preserved in checkpoint `aa50aa0` before changes. No reset or res scaffold was performed.

The updated 207-line **PAYGUARD VERIFY — MASTER CODEX CONTINUATION SPECIFICATION**, revision October 27, was fetched from GitHub commit `2da6944`, read in full, and merged in `ae089f4` after checkpoint `d353aa1`. The earlier prompt remains available in Git history. The implemented README was retained while resolving the README conflict; no application files were removed.

The owner's explicit later requirements take precedence:

1. Supplier payment-instruction verification and vendor trust references are the product focus.
2. Recipient comparisons and independent human verification must precede approval of changed instructions.
3. Public attack replays are synthetic and evidence-based, with no invented Mainnet learning.
4. Tatum uses native Sui Mainnet gRPC with secret server-side metadata.
5. Real Walrus writes and subsequent recall remain mandatory for final acceptance.
6. No automatic supplier payment; preserve work and checkpoint safely.

## Pattern provenance

[FBI: Business Email Compromise](https://www.fbi.gov/how-we-can-help-you/common-frauds-and-scams/business-email-compromise) describes impersonated vendors, subtle email/domain changes, compromised correspondence and urgency. It recommends checking requests through independently obtained contacts. These patterns inform transparent review rules, not a claim that any signal proves fraud.

| Observable signal                                | Check                                            | Human action                                                     |
| ------------------------------------------------ | ------------------------------------------------ | ---------------------------------------------------------------- |
| Proposed recipient differs from stored reference | Exact normalized address comparison              | Pause; contact supplier through pre-established channel          |
| Sender domain differs                            | Exact domain comparison; no fuzzy identity claim | Inspect origin and verify independently                          |
| Reply-to differs                                 | Exact email comparison                           | Investigate alternate reply destination                          |
| Urgency/secrecy or bypass wording                | Explicit word-pattern findings                   | Retain verification requirements                                 |
| Request provides its own contact                 | Presence indicator                               | Do not use it as the trust anchor                                |
| Trust profile postdates request                  | Date comparison                                  | Establish independent evidence, do not attest using that profile |

The normal recurring-payment replay is a negative control, not a safe-payment certification.
