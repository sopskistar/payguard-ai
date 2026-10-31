# Slush localhost and production investigation — October 31, 2026

The disappearance of the earlier localhost warning has **not been conclusively explained**. The owner reports a warning-free connection and transaction signature at `http://localhost:4320`; Neon and a fresh authenticated Tatum query independently confirm the resulting Mainnet purchase. This proves that the signed payment executed, not why Slush permitted that browser request or that every future connection will be permitted.

## Origins and observed behavior

| Origin / provider                                | Evidence                                                                                               | Current conclusion                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `http://localhost:4320` / existing Slush account | Owner-reported connection and signature; actual Mainnet receipt                                        | One successful owner operation. Repeated physical connections still need owner observation. |
| `http://127.0.0.1:4320`                          | Server binds to this interface, while APP_URL and user-facing challenge use localhost                  | A different browser origin. No physical-wallet compatibility claim.                         |
| `http://localhost:4318`                          | Historical separate self-deposit utility                                                               | Distinct origin and transaction purpose; not the service purchase.                          |
| `https://payguard-ai-henna.vercel.app` / Slush   | Historical owner-reported malicious-site warning; current physical extension unavailable to automation | Current provider verdict unverified. No clearance claim.                                    |
| Production / other Wallet Standard providers     | Runtime chain and personal-message feature discovery; controlled signature tests                       | Integration implemented. Physical Suiet/Nightly/mobile tests unavailable.                   |

Paths such as `/connect` and `/services` share their origin. Scheme, hostname and port differences create distinct origins. Cookies, stored permissions, extension caches, web-wallet metadata and authentication messages can therefore differ. They are possible explanations, not established causes.

## Legitimate application changes recovered from Git

- `dcca21c` separated ordinary personal-message authentication from financial signing and enabled the explicitly requested owner-local workflow. Hosted Slush was still removed from the login selector by an application policy coupled to the financial-signing gate.
- `bb2bc65` added only the official `https://api.slush.app` metadata host to CSP `connect-src`. This can resolve an application CSP rejection. The captured headless metadata request still returned HTTP 403, so this change is not evidence of Slush reputation clearance.
- `7a18ff9` fixed the concrete local financial capability mismatch: unsigned preparation previously worked while `signingAllowed=false`. The live launcher now permits separately owner-approved signing in the same supervised process, and stores exact prepared bytes/digests. This explains why PayGuard's signing button became usable; it does not explain Slush's warning classification.
- This continuation removes the blanket Slush **personal-message login** exclusion on valid configured HTTPS/loopback origins. Production financial signing remains paused. No warning UI is hidden, dismissed, proxied or suppressed.

The lockfile SDKs remain `@mysten/slush-wallet` 1.3.6, `@mysten/sui` 2.38.0 and the existing modern Mysten dApp Kit versions. No wallet SDK upgrade was used to claim a fix. Browser extension version is a separate fact and is not available from these package versions.

Fresh [origin/header observations](evidence/slush-origin-comparison.json) show the local development CSP includes `unsafe-eval` for Next development; production excludes it and uses HTTPS/HSTS. Both allow the official Slush metadata host and retain frame/object restrictions. Current production returns `allowed=true`, `slushBlocked=false`, `paymentSigningAllowed=false`; the real selector is accessible. This is an application-policy observation, not a Slush reputation verdict. The production browser suite and [owner/session/receipt/recall smoke](evidence/final-production-service-smoke.json) pass without claiming a physical wallet connection.

## Connection, authentication and signing are separate requests

1. Wallet Standard `standard:connect` requests account access only. Discovery does not automatically connect (`autoConnect:false`).
2. Registration/login requests `sui:signPersonalMessage` only after the user reviews a server-generated, five-minute challenge. The server verifies the exact stored message, account, origin, nonce, browser binding and atomic single use, then creates/returns a member profile. Members cannot gain owner rights or buy services. Logout and account switching revoke the application session.
3. Agent Services requests `sui:signTransaction` only after exact owner terms approval and a separate signing click. It validates returned bytes against the frozen approved bytes, and submits once through the existing facilitator path. Pending results resume the same intent.

The installed extension and official web adapter are different provider entries. Slush web registration occurs only on **Use existing Slush web account**, using the official SDK; its documented default wallet origin is `https://my.slush.app`. The owner has been asked which provider, browser and extension version completed the purchase. No extension profile, historical warning request, browser permission cache, reputation-feed response or before/after extension version was available. There is no basis to attribute a remote classification change to Codex.

Official references: [Slush app integration](https://sdk.mystenlabs.com/slush-wallet/dapp), [Mysten personal-message action](https://sdk.mystenlabs.com/dapp-kit/actions/sign-personal-message), and [Mysten public wallet blocklist](https://github.com/MystenLabs/wallet_blocklist). An exact-list non-match does not reproduce private feeds, fuzzy matching or extension caches. The historical public resource audit is preserved in [the review evidence](evidence/slush-security-review.json).

## Reproduction without financial signing

Open `/connect` on the exact production origin with the existing wallet. Select its actual provider, connect deliberately, and inspect any wallet response. If it permits connection without a warning, review and sign the ordinary personal-message challenge to register or return. If it warns or refuses, stop; use the existing provider review process. Do not use a different origin or provider to evade that warning. Record the exact origin, date, provider entry, browser/extension versions, connection outcome and personal-message outcome separately. Repeat after logout in a fresh browser context to establish reproducibility. No transfer or funded signature is needed for this test.

The public demo and owner administrator workspace remain usable independently. Current production provider behavior must be recorded from an actual wallet; headless fixture success and a local financial receipt cannot establish it.
