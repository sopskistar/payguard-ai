# Product experience and security-review release

**Validated application commit: ec74c88, Vercel Ready.** Every hosted spec ran in a fresh browser process: 18 passed / 0 failed / 3 hosted-wallet skips, zero navigation retries. The first combined run’s transport failures are preserved in the test ledger.

The public application is https://payguard-ai-henna.vercel.app/. The account-free judge journey is [/try](https://payguard-ai-henna.vercel.app/try). Product changes preserve the existing database, tenant controls, approval enforcement, confirmed memories and provider integrations.

## Public Slush review correction — deployed first

Targeted commit **faf3b31** reached Vercel Ready before the larger redesign. Open [/connect](https://payguard-ai-henna.vercel.app/connect), select **Open Slush Security Review**, then the installed Slush extension. If its warning appears, choose **Flag for review inside Slush**, without accepting the connection. Close the request afterward. Use **Disconnect review connection** if it unexpectedly connects.

This loads the official, unmodified Mysten selector only after deliberate interaction. Auto-connect, persistence and OAuth initialization are disabled. It has no signature, login-challenge, registration, session or payment action. Authentication and settlement gates remain unchanged. Public fixture tests prove connection/refusal/disconnect separation; they do not reproduce Slush’s physical warning or clear its security verdict. The owner must perform the actual extension review step.

## Product experience

- **Homepage:** six-stage synthetic invoice illustration with Play/Pause, Replay, keyboard stage selection and reduced-motion behavior. The recipient comparison changes, the approval hold activates, a practice human check is recorded, then the next illustrated review remembers the procedure. It makes no private/provider calls. Editorial sections have distinct visual treatments rather than repeated card grids.
- **Remembered-policy comparison:** actual recorded Walrus citations pass through the application’s review logic. Memory OFF and ON both retain hard recipient-change holds. The evidence capture date and original provenance are available; no hardcoded illustration is represented as live recall.
- **Workspace:** current approval gates come from the same deterministic function used by protected mutations, using tenant-scoped saved instructions, trust profiles and the latest human check. The overview displays held open invoices, saved audit events, completed owned memories, last completion and last saved Tatum diagnostic. Configuration alone is not a successful live check. Refresh shows loading, a successful timestamp or an honest failure with retry.
- **Tool explanations:** contextual expandable guidance for Inbox, Verify Instructions, Vendor Trust, Replay, Wallet Watch, Memory Lab, Audit and Settings; existing personal-workspace milestones retained. Agent Services explains its supplemental analysis role and remains separate from supplier payments.
- **Judge journey:** all seven tasks retained, with recipient and hold emphasis, animated progress/panel transitions, practice verification, Memory OFF/ON and provenance, visible Tatum capture date and local audit outcome. No private writes or provider calls occur in anonymous practice.
- **Brand:** owner-uploaded root files copied byte-for-byte to `public/brand/logo.png` and `public/brand/icon.png`. The new transparent monogram and wordmark appear throughout navigation, workspace, review page, judge, footer, manifest and favicon metadata. Navy wordmark lettering uses a deliberate light plaque for contrast. Visible application text says **PayGuard Verify**.

## Access and data provenance

| Path                 | Actual capability                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public demo          | Synthetic invoices and local practice decisions; no account, wallet, funds, private audit or writes                                                                            |
| Regular user         | Wallet identity, one-time personal-message authentication and isolated accounts implemented and tested in controlled environments; hosted registration remains security-paused |
| Public wallet review | Official connection only, no authentication; unexpected connection can be disconnected                                                                                         |
| Administrator        | Private owner password, separate role and secure session; persisted Neon records and deliberate live provider operations                                                       |
| Mainnet proof        | Sanitized, dated evidence: 30 original owner records plus 2 controlled tenant records; genuine recall and Tatum transaction data                                               |

Saved synthetic exercises remain explicitly marked; persistence does not make them real customer or fraud data. No simulated activity stream, invented users, incoming invoices or decorative provider polling was added. A wallet address proves control, not supplier legitimacy; chain execution proves value movement only when exact credit is established.

## Validation and visual evidence

Latest measured results and deployment identity are recorded in [the test ledger](TEST_RESULTS.md) and [release status](RELEASE_STATUS.md). Public-only screenshots use 100% browser zoom, fresh unauthenticated contexts, 1440×1000 desktop and 390×844 mobile. No owner credentials, private records, traces or video are captured.

| View                   | Desktop                                                                                                                           | Mobile                                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Homepage               | [Full page](evidence/screenshots/release-home-desktop.png) · [First viewport](evidence/screenshots/release-home-desktop-fold.png) | [Full page](evidence/screenshots/release-home-mobile.png) · [First viewport](evidence/screenshots/release-home-mobile-fold.png) |
| Judge memory step      | [Screenshot](evidence/screenshots/release-judge-desktop.png)                                                                      | [Screenshot](evidence/screenshots/release-judge-mobile.png)                                                                     |
| Public workspace       | [Screenshot](evidence/screenshots/release-workspace-desktop.png)                                                                  | [Screenshot](evidence/screenshots/release-workspace-mobile.png)                                                                 |
| Review-only connection | [Screenshot](evidence/screenshots/release-connect-desktop.png)                                                                    | [Screenshot](evidence/screenshots/release-connect-mobile.png)                                                                   |

## Deployed visual smoke

Production ec74c88 returned **200 on all 16 desktop/mobile route checks** (eight routes in two viewports), with zero overflow, broken images or browser errors. [Actual production measurements](evidence/product-production-visual.json). These additional screenshots were captured directly from production in fresh public contexts:

- [Production desktop first viewport](evidence/screenshots/production-home-desktop-fold.png) · [Production mobile first viewport](evidence/screenshots/production-home-mobile-fold.png).
- [Production judge memory step, desktop](evidence/screenshots/production-judge-desktop.png) · [Production judge memory step, mobile](evidence/screenshots/production-judge-mobile.png).

The earlier screenshots above preserve the rebuilt local QA views. Neither set contains private records or credentials. Public sample data, recorded proof and actual workspace operations remain separate.

## External boundaries

Slush’s reported malicious-site verdict remains unresolved. Loading a selector or a clean dependency audit is not clearance. Physical Slush/mobile wallet onboarding and production customer registration are not certified. The owner must follow the provider’s review process; no wallet/domain workaround is suggested.

The x402 Mainnet implementation has real non-spending facilitator/Tatum preflight but **zero settled service payments**. The [approval worksheet](MAINNET_PAYMENT_APPROVAL.md) is incomplete until `SERVICE_PAYMENT_PAYER` and `SERVICE_PAYMENT_RECIPIENT` are configured. Native-SUI price is 0.001 SUI (1,000,000 MIST), sponsor gas budget 2,000,000 MIST, payer gas cap zero. Keep settlement disabled. Exact owner approval, legitimate wallet clearance, actual service delivery and independent receipt verification remain required. No payment-bonus completion is claimed.

No database reset, memory reseed, funded signature, settlement, force-push, demo video or submission form was performed.
