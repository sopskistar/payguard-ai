# Owner-operated local test payment

This narrowly scoped terminal runner uses the existing Production customer authentication, quote, preparation, settlement and receipt APIs. It adds no application endpoint or signing service. A successful SDK payment would establish local test-wallet acceptance; it would not establish Nightly browser-extension financial-signing acceptance.

The owner-authorized account-specific Ed25519 key stays in `~/.config/payguard-test/sui.key`, readable only by its owner. The runner derives and checks the exact recorded customer address before authenticating. It never prints, uploads, stores in application code or passes the key on the command line. Personal-message authentication and financial signatures are distinct operations.

Before any fresh quote, the runner checks the expected Production release, disabled recovery, three authenticated customer recovery audits, customer allowance, sponsor budget, absence of outstanding attempts, Harborline invoice identity, canonical Mainnet, provider readiness, payer balance and signing support. The unrelated administrator hold remains in its own workspace. The earlier unsigned quote `85e9fc3e-8871-4c15-ae3c-73de9f6421ca` was cancelled through its genuine customer session, with one audit and zero reservation release.

In an owner-controlled interactive terminal, run:

```bash
bash tools/service-acceptance/terminal.sh
```

The runner requires the owner to type **`BEGIN ONE PURCHASE`** before its only fresh quote request. It validates the 1,000,000 MIST terms, payer, merchant, sponsor, Mainnet, expiry and frozen transaction bytes/digest. It then displays the full transaction summary and requires **`SIGN <exact displayed digest>`**. Only that confirmation permits one local financial signature and one normal application submission. The owner should approve promptly; an expired quote stops the operation.

The private `.data/terminal-acceptance-operation.json` journal is created exclusively, preventing another runner from silently creating a second attempt. Do not remove it to retry. Signature values are not logged; only their hashes are recorded. The local transcript contains public terms and typed confirmations, never the private key. Keep `.data` untracked.

Any rejection, timeout, ambiguous response or validation failure stops the runner. It never automatically replaces, signs again or resubmits an attempt. Reconcile the exact journaled intent and digest through authorized reads before deciding what happens next. No direct database edits or financial overrides are available.

Verified completion requires independent full-node finalization and Tatum evidence, the exact merchant credit and payer debit, the original prepared digest, one persisted customer receipt/report, unchanged report reopening, and consistent customer/sponsor accounting. A settled purchase continues to consume its allowance; it is not an unresolved hold. Until those checks pass, report the payment as incomplete. Nightly extension acceptance remains a separate physical test.
