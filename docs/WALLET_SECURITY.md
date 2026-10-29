# Wallet authentication and private accounts

**Current release gate:** hosted onboarding is blocked pending investigation of the owner's Slush malicious-website warning. [Review case and owner action](SLUSH_SECURITY_REVIEW.md). Both wallet login endpoints reject hosted requests before issuing/consuming a challenge. The connection SDK is not loaded by the paused connection page or hosted session monitor. New service-payment approval and settlement also fail closed; read-only reconciliation of an already submitted digest remains possible. There is no production environment bypass. Tests on loopback use unfunded controlled fixtures, not an overridden wallet warning. Previous deployed fixture results do not certify physical Slush onboarding.

This is an operator-managed application, not decentralized identity certification or end-to-end encrypted personal storage. Wallet login proves signing control only. It never grants administrator rights or authorizes supplier payments.

## Sign-in

Modern Mysten `@mysten/dapp-kit-react`/core, Sui SDK v2 and Sui Wallet Standard provide browser discovery and `signPersonalMessage`. No legacy JSON-RPC dApp Kit is used. `/connect` shows connection and authentication as separate steps and displays the exact message before signing. Compatible desktop extensions and mobile wallet browsers can connect; no broad physical-device certification is claimed.

The server creates a random challenge ID, 256-bit nonce, issued time, five-minute expiry, normalized full wallet address, purpose and exact configured application origin. Another independent random value binds the row to a secure HttpOnly SameSite Strict browser cookie. The server stores the full authoritative message; verification accepts only challenge ID, address and signature, never client-provided message text, roles or tenant IDs. Origin checks protect both challenge and verification requests.

Mysten verifies the personal-message intent and expected address. Atomic database consumption requires an unexpired, unused challenge. A unique wallet address identifies the automatically created member profile. Concurrent verification succeeds once; replays fail. Returning wallets reuse the same profile. The new random session rotates and revokes the previous browser session. Only hashed session identifiers are stored; the HttpOnly SameSite Strict cookie is Secure on HTTPS and expires after eight hours. Logout deletes the server row and cookie. Account changes/disconnection observed by dApp Kit revoke a member session before a new sign-in; an administrator session is not silently converted to a wallet account. Merely disconnecting a wallet outside an observed page does not revoke a previously issued cookie: use Sign out to revoke it explicitly.

## Isolation

The current account-switch monitor compares wallet events directly with the authenticated snapshot identity. It hides private data immediately, then revokes the session; it does not wait for a network session read. A failed logout keeps a locked retry screen. The controlled Wallet Standard browser test aborts that logout deliberately and proves no old account data reappears before successful revocation. Hosted onboarding remains paused, so this is local controlled evidence.

The authenticated session supplies the user UUID used as the tenant. Database queries scope invoices, vendors, settings, rules, human verifications, decisions, audits, jobs, recalls, wallets and reconciliation to it. Foreign invoice/vendor/job identifiers return not found. Administrator-only routes separately check role: seed/reset, account health/credential diagnostics and all service-payment pilot operations. Wallet accounts are always members, and an existing administrator identity cannot be opened with wallet login.

Walrus uses a backend-managed operator account. The browser never receives its delegate key or provider authentication. The backend derives a namespace from authenticated ownership. It additionally loads confirmed tenant-owned job records and requires an exact blob/payload match with an owned policy before a recalled result can influence a review. A foreign result returned by the SDK is discarded. The provider's shared account and namespace are not customer security boundaries; the application server and Neon ownership checks are. Raw invoice/contact/free-text correction data is never written to Walrus. Users consent to fixed minimized policy templates. Operator access and provider retention are disclosed at `/privacy`.

## Tests and limits

`tests/wallet-auth.test.ts` uses an isolated migrated PostgreSQL database and real ephemeral Ed25519 personal signatures for registration, returning identity, wrong signer/browser/domain, expiry, replay, concurrency, session rotation, member/admin separation and foreign-record operations. The SDK recall mock deliberately returns another user's exact blob/text; it cannot influence the second user. These mocks are authorization tests, not Mainnet evidence.

`tests/e2e/wallet.spec.ts` exercises actual HTTP cookies/APIs and a Wallet Standard browser test wallet. The private key stays in the Node test process and is never sent to the browser or persisted. No test spends funds or writes new memories. Existing owner and live read-only provider regressions remain separate.

Account recovery/export/deletion, teams, delegated reviewers, multi-factor administrator login, durable operational monitoring and external penetration testing remain future work. Losing wallet signing access loses normal account access. A valid wallet signature does not authenticate a business or human. Global quotas limit shared integration usage but do not replace production abuse monitoring.

Browser QA disables automatic DOM failure snapshots, trace, screenshot and video artifacts because entered credentials may appear in diagnostic DOM snapshots even when the UI masks them. The owner password form clears its input immediately after submission. Explicit synthetic-page still images are reviewed separately; private authenticated forms are never published.

## Password rotations and diagnostic redaction

Additive migration `0005` stores a keyed administrator credential version on sessions. Every owner request checks it against the currently configured password version. Changing `OWNER_PASSWORD` makes previously issued owner cookies unauthenticated; legacy owner sessions without a version also fail closed. Wallet sessions have independent identities and are not invalidated by an administrator password rotation. No raw password is stored in Neon.

A credential-redaction reporter runs before Playwright console/HTML reporters and cleans known private values from errors, step titles, buffered output and text attachments before embedding. Unit tests cover nested errors and attachments using synthetic values. Automatic DOM snapshots, traces, screenshots and video remain disabled. The login input clears immediately on submission. This is defense in depth; application/test code must continue to avoid logging credentials.

The client hides private workspace data as soon as logout is requested. If the server cannot confirm revocation, a locked retry screen remains; failed snapshot refreshes cannot restore old data. Session-generation checks discard responses from an older identity. Read-only transport retries are bounded to one and never repeat writes or payments.

## Controlled real-provider two-customer proof

The October 29 [API proof](evidence/two-tenant-mainnet-memory.json) used two ephemeral unfunded identities, real Neon accounts, and at most two sponsored managed-Mainnet writes. Each user logged out and signed in again before a later synthetic invoice recalled its own blob/policy. Both directions denied foreign invoice, approval, deletion, job-resume, snapshot and recall access, and member access to administrator/payment routes. [Independent SDK status check](evidence/two-tenant-provider-recheck.json) confirms both jobs, blobs and namespaces. Original owner records are untouched. This upgrades provider-boundary evidence beyond mocks; it does not certify physical production onboarding or remove the trusted operator/shared-account model. No private key or session cookie was persisted.
