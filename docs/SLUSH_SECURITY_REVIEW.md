# Public Slush review access — targeted correction

Open **https://payguard-ai-henna.vercel.app/connect** without an account or owner password.

1. Click **Open Slush Security Review**. This loads the official Mysten wallet selector only after your interaction.
2. Choose the installed **Slush browser extension**.
3. If Slush shows its genuine malicious-site warning, select **Flag for review inside Slush**. Do not accept the connection, dismiss the warning to proceed, or request a signature.
4. Close the request after submitting the review. If the wallet unexpectedly returns a connection, use **Disconnect review connection**. No login, registration or payment follows.
5. If no warning or review option appears, stop and follow up with the existing Slush support case. Share the exact origin, extension/browser versions and a redacted still screenshot; never provide wallet secrets. Absence of a warning is not security clearance.

This component uses the installed official `ConnectModal`, `autoConnect: false`, `storage: null`, and no OAuth initializer. The server wallet-authentication and x402 settlement gates are unchanged. The controlled browser tests use explicitly labeled fixture wallets: they do not reproduce a genuine Slush warning or submit a provider review. The owner must perform the physical-extension step.

---

# Slush domain review — unresolved, onboarding paused

**Status: BLOCKED BY THIRD PARTY.** The owner has submitted the official domain-security review request and reports Slush showing “Malicious website — This site has been flagged for malicious behavior.” at `https://payguard-ai-henna.vercel.app/connect`. This is not dismissed as a false positive. A physical Slush extension is unavailable in the controlled test browser, so this run cannot independently reproduce or clear its verdict.

Hosted wallet authentication and new service-payment signing/settlement remain paused in application code and server APIs. A separate public review-only connector is available on `/connect`, after deliberate interaction, using the official Mysten Wallet Standard modal with auto-connect and persistence disabled. It has no authentication or signing actions. There is no hosted environment override. `/try`, `/proof` and password-based owner administration remain available. Local loopback fixtures use unfunded ephemeral identities and never bypass production wallet protection. Existing data, sessions, Mainnet memories and proof are preserved.

## Evidence collected

Run `node --import tsx scripts/security-review.ts` for a public read-only audit; see [timestamped evidence](evidence/slush-security-review.json). The initial deployed baseline identified commit `8129c3a`. `/`, `/connect` and `/try` returned HTTPS 200 without redirects. Fourteen fetched script assets were served from the exact application origin; hashes are recorded. No iframe appeared in those responses. CSP restricts script loading to self (Next.js inline bootstrap allowed), disallows framing/objects, and bounds network connections to self and Sui foundation endpoints. Fonts and brand images are self-hosted. This is a resource review, not a malware certification or full penetration test.

The official [Mysten wallet blocklist](https://github.com/MystenLabs/wallet_blocklist) was inspected at `src/domain-list.json`, `blocklists/domain-list.json` and `allowlists/domain-list.json`. The current combined list contained 50,630 blocked strings; neither the exact production hostname nor its parent domain matched an entry in this exact-membership check. List hashes and URLs are recorded. **This does not reproduce private/remote verdicts, fuzzy matching, extension caches or all reputation services, and does not establish that Slush considers the site safe.** The public list-sync source also references a private upstream; no access to that feed is assumed.

Installed dependencies are pinned in `package-lock.json`; the current npm advisory audit reports zero vulnerabilities. This is not proof of absence of supply-chain compromise. Reviewed sign-in requests are Wallet Standard connection and `signPersonalMessage` only; server-issued text binds origin, wallet, purpose, nonce and expiry. Login code calls no financial transaction-signing function. The separate owner-only Mainnet/development-Testnet service implementation has never settled and is blocked on the hosted origin during review. No remote wallet OAuth popup is initialized (`slushWalletConfig: null`); this config predates the warning and is not a workaround. Installed Slush extensions use Wallet Standard as [Mysten documents](https://sdk.mystenlabs.com/slush-wallet/dapp).

The exact sign-in origin is derived from server-side `APP_URL` and must equal `https://payguard-ai-henna.vercel.app`. The browser cannot supply its own message, role, user ID or namespace. Signature checking does not prove supplier identity. No application form requests recovery phrases or spending private keys.

## Owner-submitted review and reference request

The following retained instructions describe the already-submitted case; do not submit duplicate tickets. The remaining owner action is to retain the ticket privately and share the provider outcome/remediation requirements.

1. Open the [official Slush support request](https://support.slush.app/hc/en-us/requests/new), reached from [Slush's security page](https://slush.app/security). Enter your own contact email.
2. Subject: `Domain security review: PayGuard Verify / payguard-ai-henna.vercel.app`.
3. Paste the request below in Description. Add the actual browser, OS, Slush version, date/time and whether the warning appeared before connection, during connection or before personal-message signing in Environment.
4. Attach a still screenshot showing the warning and exact origin, redacting balances, account names and unrelated tabs. The screenshot description presently available is **owner-reported warning panel with the text quoted above**; no screenshot or extension telemetry has been manufactured. Do not override the warning to obtain additional evidence. Do not provide a private key, recovery phrase, session cookie or owner password. If the wallet-address form field is required, use only an unfunded address you control.
5. Submit and retain the ticket ID privately. Ask Slush to identify the specific verdict/list and review the exact origin. Do not migrate to another domain or wallet to evade the warning.

Prepared request (not submitted by this agent):

> I maintain PayGuard Verify at https://payguard-ai-henna.vercel.app/ (source https://github.com/sopskistar/payguard-ai). Slush displays “Malicious website — This site has been flagged for malicious behavior.” at /connect. Please investigate the origin's reputation and identify the relevant detection or unsafe behavior. We have paused hosted wallet onboarding and all new service-payment signing pending review. The public synthetic judge walkthrough remains usable without a wallet at /try. Login is a domain-bound, one-time personal-message signature verified on the backend; it does not authorize transactions. No supplier payment path exists. A separate disabled, owner-only Mainnet/development-Testnet service implementation has no settlement evidence. Our read-only review, resource hashes, security boundaries and limitations are public at https://github.com/sopskistar/payguard-ai/blob/main/docs/SLUSH_SECURITY_REVIEW.md and docs/evidence/slush-security-review.json. We are not assuming a false positive. Please advise any remediation and review requirements. Browser/OS/Slush version and redacted warning screenshot: [owner supplies actual details].

Only reopen hosted onboarding after a provider response, resolution of identified findings, and a controlled unfunded desktop/mobile retest on the exact production origin. Any real-value payment still requires separate explicit authorization of exact terms. Changing an environment variable cannot clear this release gate.

## Wallet compatibility targets

[Official Sui Wallet Standard](https://docs.sui.io/onchain-finance/asset-custody/wallets/wallet-standard) separates personal-message signing from transaction execution. [Suiet documents personal messages and current transaction methods](https://kit.suiet.app/docs/Hooks/useWallet/); [Nightly documents Wallet Standard discovery](https://docs.nightly.app/docs/sui/sui/detection/) and [personal-message signing](https://docs.nightly.app/docs/sui/sui/sign_message/); some published transaction examples use legacy methods, so current signing capability must be detected rather than assumed. Runtime feature and account-chain checks remain mandatory. No physical Suiet, Nightly, mobile deep-link or Slush connection has been certified in this run. These are post-clearance/local compatibility targets, never alternatives for evading the reported production warning.

The refreshed public-resource review found only same-origin script assets, no unexpected redirects/iframes, and no exact hostname/parent match in the inspected official public lists. Private feeds, cached verdicts and fuzzy matching remain unavailable. Zero npm advisories and these observations do not establish safety or clear Slush. Hosted onboarding remains paused.
