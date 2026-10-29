# October 29 — security, learning and interaction continuation

Final local checks: **93 unit tests / 15 files passed; lint, TypeScript, formatting and Webpack production build passed.** Isolated local PostgreSQL browser suite: **12 passed / 3 explicit skips**, including real ephemeral personal-message signatures, nonce/expiry/replay/returning accounts, interrupted account-switch logout, two-user HTTP authorization, seven judge steps, mobile CTA spacing, Refresh failure/retry, owner persistence and human-verification invalidation. Skips are the two disabled live-provider cases and the hosted-only wallet pause. One unit run concurrent with the build hit the PostgreSQL-WASM setup timeout (88 passed / 5 skipped / one failed suite); the isolated rerun passed all 93. The first sandbox build was blocked at TypeScript subprocess inspection; the authorized build completed.

Actual hosted run on `7128c11`: **7 passed / 5 failed / 3 explicitly skipped**. Public judge, guest authorization, human verification, credential clearing, hosted wallet pause and live cross-session Walrus recall passed. Five failures were public/replay loading, owner-submit timeout, two browser-navigation recovery interruptions and a responsive tour timeout. The navigation helper now stops the pending Chrome error navigation before its single read-only retry and attaches sanitized request-failure metadata. No HTTP error/assertion is ignored, and no mutation/payment is retried automatically. This is not a full green hosted suite.

Separate credential-safe production API verification passed: current owner login and secure session cookie, authenticated Neon snapshot, persisted audit in a fresh session, revoked cookie rejection, Walrus health and seven tenant-owned recalled citations versus zero OFF, baseline preservation, and live Tatum Mainnet digest inspection at checkpoint `339460501`. [Raw evidence](evidence/production-core-smoke.json). Fresh old/new owner-password tests passed (obsolete 401, current 200), and the deployed session guard rejected legacy and superseded sessions and removed its temporary test session. No values were logged. [Rotation](evidence/password-rotation.json) · [Session guard](evidence/session-rotation.json).

Walrus SDK preflight freshly verified **30/30 completed jobs with matching blobs and 30 retention rows**, without writes/renewals. Four actual semantic recalls reused across 18 synthetic scenarios met 18 contracts, preserved 18 baselines, and produced 0 false / 0 missed holds (11 required holds, 7 allowed). There were 59 applied and 481 excluded candidate/case pairs, not a semantic precision score. Provider and learning artifacts are published separately from mocked unit contracts.

Current dependency audit: zero vulnerabilities. Credential audit: 808 workspace files, eleven decoded report archives and Git history, including current and historical configured credentials: zero matches outside the intentionally excluded `.env.local`. A synthetic failing redaction canary from the prior release remains preserved. Automatic DOM snapshots, traces, screenshots and video are disabled; textual error-context attachments are redacted before reporters embed them. No video was created.

Wallet onboarding remains blocked on hosted origins pending Slush review. Local fixture success does not clear the warning or certify physical/mobile wallets. No real service payment was signed/submitted/settled. See [complete release status](RELEASE_STATUS.md) and [Slush case](SLUSH_SECURITY_REVIEW.md).

---

# Verification results — October 28, 2026

This ledger distinguishes fixtures, live integrations, and deployment. Local final checks passed; hosted rollout remains separately tracked below.

| Gate                                               | Actual result                                                                                                                                                                    |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dependency install / vulnerability review          | Install completed; npm audit reported 0 vulnerabilities after adding Prettier                                                                                                    |
| TypeScript / lint                                  | Passed on final source                                                                                                                                                           |
| Vitest                                             | 51 tests passed across 6 files                                                                                                                                                   |
| Production build                                   | Final Next.js 16.4.3 Webpack production build passed                                                                                                                             |
| Neon migration and sample seed                     | Applied successfully to configured Neon; additive migrations retained                                                                                                            |
| Public browser / authorization / owner persistence | 4 final Playwright tests passed, including save/new-context persistence, human verification through the UI, and rejection after edited instructions                              |
| Live browser memory loop                           | 1 opt-in Playwright test passed in 56.8 seconds; real write, confirmation, new session, exact blob recall and finding influence                                                  |
| Fresh-process recall                               | Passed against live Walrus and Neon; 12 returned memories, three applied vendor citations                                                                                        |
| Mainnet seeds                                      | 12/12 confirmed, no pending or terminal failures; one additional browser correction makes 13 total                                                                               |
| Tatum native Mainnet gRPC                          | Live identity, checkpoint, real digest and coin metadata passed                                                                                                                  |
| Live reconciliation                                | Correctly rejected an unrelated real transaction as Mismatch; no payment created                                                                                                 |
| Positive payment matching                          | Synthetic fixtures test positive/negative exact-unit paths and uniqueness; no real positive supplier payment claimed                                                             |
| Responsive review                                  | Desktop/mobile screenshots visually reviewed; corrected table overflow; overview, inbox, review, replay, memory and vendor views passed 390px overflow checks                    |
| Public Vercel deployment                           | Vercel reported successful deployment of `10ec793`; both standard project aliases require Vercel login, so hosted public/owner smoke tests are BLOCKED. The old homepage is 404. |

The unit provider mocks are **not** Mainnet evidence. See [actual proof](MAINNET_PROOF.md) and [reviewed JSON](evidence/).

## Commands

```bash
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
npm run start
npm run test:e2e
npm run memory:seed
npm run memory:prove-recall
npm run proof:export
TATUM_TEST_DIGEST=os1iG8zow278c6hqxbuyxnvMUjzThsD8GTY8atdfzW6 npm run check:live
```

Owner browser tests need `E2E_OWNER_PASSWORD` loaded privately. The live write/recall test additionally requires `LIVE_MEMORY_TEST=1`; it deliberately creates a real minimized synthetic memory. Browser traces are disabled to avoid retaining credentials. Do not place passwords on a command line or in test fixtures.

The Playwright-managed Chromium download hit TLS connection resets. Validation used the existing installed Chromium headless shell via `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. This is recorded rather than claiming the download succeeded. Standard setup is `npx playwright install chromium` on a machine with registry/CDN access.

Earlier failures: unfinished npm installation resolved; Webpack build used after local Turbopack worker restrictions; seed interruptions resumed with durable IDs; pending provider jobs later confirmed; owner login button fixed for short viewports; owner test changed to await the actual save response; manual transaction inspection succeeded despite intermittent tip discovery. No failed run was counted as passed.

Final publish scan: 179 repository/client-bundle files checked against configured secret values; zero matches. `.env.local` and runtime evidence remain ignored. Formatting check and `git diff --check` passed.

## Publication and deployment

Code and evidence were pushed normally to public GitHub (`10ec793`), preserving the remote specification history. Vercel deployment `Bxa7c6ocT3pS3rXjaUpRnjMRanth` reported success. `https://payguard-ai-sopskistars-projects.vercel.app` and the main-branch alias redirect to Vercel authentication; the repository homepage `https://payguard-ai-henna.vercel.app` returns 404. These are not a verified public demo. The owner must expose the intended production domain and confirm server environment settings before hosted integration tests can run.

The [technical article](https://sopskistar.github.io/payguard-ai/) was published using GitHub Pages from `/docs` and returned HTTP 200. Source, screenshots and reviewed proof remain in this repository. No video has been recorded or submitted.

The additional opt-in **live Tatum browser test passed in 16.0 seconds** against the local production build: real digest → Transaction Inspector → actual chain evidence → sample invoice verification → visible Mismatch and zero recipient credit. This validates Next.js route and UI wiring as well as the CLI adapter. Across separate runs, four core browser tests plus one real Walrus and one real Tatum test passed. Enable `LIVE_CHAIN_TEST` and provide `TATUM_TEST_DIGEST` explicitly to repeat it; it performs chain reads and records the negative comparison, not a payment.

## Current continuation release

The saved `652a397` baseline was rechecked: TypeScript, lint and all 51 unit tests passed. All 13 original memory jobs were freshly confirmed `done` with matching SDK blobs. Neon responded and migrations `0002`/`0003` were applied additively for service intents/receipts. The bounded expansion then reached **30 confirmed, 0 pending, 0 failed** at `2026-10-28T23:00:52.070Z`. [Quality results](MEMORY_EVALUATION.md) are from actual semantic recall.

Fresh Tatum Mainnet service check returned checkpoint `339208670` and the existing real digest at `2026-10-28T22:42:31.319Z`. Tatum Testnet read-only service identity returned the correct Testnet genesis and checkpoint `400320637`; no settlement was attempted.

New tests cover the public judge journey, expiration, edit invalidation, missing recipient holds, x402 caps/nonce/network/command validation, explicit approval, cross-tenant access, single settlement and timeout/resume. Payment persistence tests use signed synthetic transaction bytes and mocked providers, never real settlement proof. Final test/build/browser results are recorded below after the run.

No demo video was generated, captured, edited, rendered or uploaded. The owner handles that separately.

Final local continuation checks: **63 unit tests across 9 files passed; TypeScript, lint, formatting and production Webpack build passed. Eight browser tests passed in 2.3 minutes**, including owner persistence, exact human verification/edit invalidation, public judge desktop/mobile controls, unauthenticated service-payment denial, real Tatum inspection/mismatch, and genuine recall in new authenticated contexts. `LIVE_MEMORY_REUSE=1` reused the original confirmed correction instead of writing again. The separately served GitHub Pages judge bundle passed its complete desktop/mobile journey. No videos were recorded.

A publish scan checked 259 repository/client-bundle files against configured secret values with zero matches. Final dependency installation/audit reported zero vulnerabilities after removal of the rejected payment SDK. Public Vercel owner workflows remain untested because deployment protection requires owner action. The service payment has no real settlement receipt; its tests are synthetic provider fixtures.

The final service-method security guard was rebuilt and rechecked: authenticated GET on a service action returns 405, while the full independent-verification/edit-invalidation browser workflow still passed (38.9 seconds). This was a focused regression after the 8/8 complete run.

## Hosted judge release verification

Release `aaf0ceb` was pushed normally and Vercel reported a successful deployment. GitHub Pages built that commit. The public judge at https://sopskistar.github.io/payguard-ai/try/ returned HTTP 200; the served JavaScript SHA-256 matched the locally tested bundle. A real hosted browser run completed all seven steps, tested 390px mobile layout, displayed 30 confirmed records, and observed zero page errors and zero POST requests. [Raw hosted smoke evidence](evidence/hosted-judge-smoke.json). The updated article remains public at https://sopskistar.github.io/payguard-ai/.

The Next.js app's project alias still requires Vercel authentication. No hosted owner or paid-service success is claimed through that gate. Local production workflows and the public static judge were verified independently.

## October 29 UTC — wallet accounts and product UX release

Preserved upstream `49e4cfd` and all existing work/evidence. Neon additive migration `0004` applied successfully; no reset or seed overwrite. No new memory writes or payments were executed.

- Lint: passed, zero warnings after excluding ignored local diagnostic artifacts.
- TypeScript: passed.
- Unit suite: **77 tests passed across 11 files**, including real personal-message signatures, one-time challenge consumption/replay/expiry/domain/browser checks, returning profiles, session expiry/rotation, role separation, foreign invoice/vendor/job/correction denial, and foreign-blob recall rejection. Three added sparse-history controls prevent learned false alarms on established recipients.
- Production Webpack build: passed, including `/connect`, `/privacy`, `/proof`, `/api/release` and existing app routes.
- Dependency audit: **0 vulnerabilities**.
- Wallet Standard UI regression: passed connection → displayed personal-message challenge → server-authenticated workspace → account-change revocation, with a test wallet that throws if any transaction signature is requested. This is a browser test wallet with genuine Ed25519 personal signatures, not certification of physical mobile wallets.
- Refresh regression: passed slow-request loading/disabled state, honest timestamped success, injected 503 with no false success, and Retry. Earlier failures were test selectors including an extra subtitle or LEARN badge, not successful request handling.
- SDK Mainnet preflight: **30/30 existing records confirmed and matching provider blobs**. No duplicate writes, pending jobs counted as success or retention renewals.
- Fresh native Tatum gRPC read: chain `35834a8a`, checkpoint `339239337`; inspected genuine digest `os1iG8zow278c6hqxbuyxnvMUjzThsD8GTY8atdfzW6`, finalized at `339078672`. Unrelated recipient evidence remains a mismatch, not a supplier payment claim.
- Expanded learning evaluation: **18/18 specified synthetic contracts met**, 18 baseline findings preserved, four genuine SDK recall queries succeeded, 16 scenarios applied memory, zero stale/wrong-scope application, zero of four unchanged controls gained critical warnings. The preserved first run met 15/18 and exposed three false alarms. Applicability was 10.9% of candidate/case pairs; no real-world fraud accuracy or semantic precision is claimed.
- Production before this code release: owner login 200; authenticated Neon snapshot 200 with 30 records; actual Walrus/Tatum health Connected. Exact deployed Git SHA and the final release's browser/auth/recall/persistence smoke are captured separately after publication.
- Payment preflight: facilitator `/supported` HTTP 200, Sui exact v2 advertised. **No service settlement**, funded-wallet test or bonus completion is claimed. `ENABLE_AGENT_PAYMENTS` and `SERVICE_PAYMENT_RECIPIENT` remain pilot setup requirements.

Secret-value scan found zero matches across 195 candidate source/documentation/assets. Values were never printed. Browser trace/video capture is disabled; no demo video was created.

Final complete local browser run: **12/12 passed in 2.6 minutes**, including the real read-only Tatum and preserved-correction cross-session Walrus tests. No new Mainnet write was made.

### Deployed production checks

Vercel reported commit `f26f5a722dd46a068797f42c925b9108f4085d80` Ready and `/api/release` matched it. [Sanitized actual production evidence](evidence/production-release.json):

- Actual owner **browser form** login passed. Cookie was Secure, HttpOnly, SameSite Strict.
- Authenticated Neon snapshot returned owner mode and 30 confirmed jobs. A review audit persisted through logout and a new authenticated browser context.
- Live Walrus recall returned 30 matched confirmed candidates; seven applicable owned citations influenced the review, versus zero OFF. Every baseline finding was retained.
- Actual Tatum Mainnet gRPC returned chain `35834a8a`, checkpoint `339250059` and the genuine digest; reconciliation remained correctly **Mismatch**.
- Deployed public/authorization/judge/Refresh/desktop/mobile/proof checks passed. Wallet HTTP registration, returning persistence, logout and A/B isolation passed. Wallet Standard connection → genuine signed personal message → authenticated workspace → account-switch revocation also passed against Vercel.

Repeated browser runs initially saw two interruptions: a five-second assertion ran before the authenticated snapshot completed (the test now awaits that actual response), and `net::ERR_NETWORK_CHANGED` prevented runtime/font assets from loading. A public-asset-only diagnostic identified the latter; later deployed wallet UI retest passed in 7.9 seconds. No server configuration was missing and no failed attempt was reported as a successful login. A native reload form now provides recovery if wallet runtime loading is interrupted. Full production browser results after that follow-up are recorded below when completed.

The source and final client-bundle scan covered 295 files with zero configured credential matches. Formatting passed after fixing two whitespace-only warnings. No wallet signing key was stored, no service payment settled, and no video was made.

A later 13-test rerun was interrupted after local owner/provider service failures; it is not counted as a second complete pass. The native no-JavaScript wallet reload regression passed independently. The prior complete 12-test run remains the full green suite. Credential handling was strengthened: password inputs reset on submit, automatic Playwright DOM snapshots are disabled and generated private diagnostic artifacts are removed. Any new production smoke results must be recorded separately from local tests.

The follow-up nine-test deployed run had six passes and three failures: one explicit ERR_NETWORK_CHANGED navigation, one authenticated snapshot timeout and one landing interaction timeout. Earlier deployed wallet UI and isolation runs did pass individually. This later run is not reported as a clean suite. Twenty-one administrator sessions were revoked after private diagnostic cleanup; owner password rotation is required before additional owner checks. No customer records or Mainnet proofs were removed.

## Rotated credentials and final safeguards — October 29 UTC

Production `c92f608` resolved the initial environment mismatch: previous password → **401 INVALID_LOGIN**, current password → **200**, authenticated owner session with Secure/HttpOnly/Strict cookie, logout → old cookie unauthenticated. [Sanitized rotation proof](evidence/password-rotation.json). The [deployed session guard proof](evidence/session-rotation.json) rejected legacy and superseded credential versions, returned 401 on a private endpoint, restored current-version access and removed the controlled test session. No customer records were changed.

- **80 unit tests passed** across 12 files; lint, TypeScript, formatting and production build passed. Rotation tests preserve independent wallet sessions.
- Latest isolated local PostgreSQL QA: **12 browser tests passed, 2 explicit live-provider skips**, 35.7 seconds. This is local QA, not Neon/Mainnet proof.
- Production broad run: **9 passed, 5 failed**, 3.4 minutes. Both genuine live Tatum and existing-correction Walrus cross-session tests passed. Three failures were direct ERR_NETWORK_CHANGED navigation failures, one was an owner-login state wait and one verification/cleanup timed out. The focused rerun passed public navigation, mobile landing/proof and independent verification, with owner intake and no-JavaScript recovery still affected by loading/network interruption. Do not present the broad run as fully green.
- Loading UX fix: workspace controls wait for attached handlers; native reload and no-JavaScript guidance remain available; landing memory toggles wait for readiness. The final local QA suite above covers this behavior.
- [Credential audit](evidence/credential-audit.json): no old/new passwords or configured credentials in source, generated artifacts or Git history, including decoded report archives. Approved `.env.local` is excluded.
- [Synthetic negative-control reporter test](evidence/diagnostic-redaction-test.json): intentionally failed with a non-secret canary; console and decoded HTML archive were redacted. Actual credentials were never used in the negative control. Step titles and buffered output are also cleaned before reporting.

Automatic DOM snapshots, trace, screenshots and video are disabled. The password input clears on submit. No service payment was settled or demo video created.

## Final private-cache recovery regression

- **83 unit tests passed across 13 files**. New transport tests prove one safe GET retry, no retry/success on HTTP errors, and no automatic mutation retry.
- Lint, TypeScript, formatting and production build passed.
- Latest isolated PostgreSQL QA: **12 browser tests passed, 2 live-provider skips**, 32.6 seconds. Both provider tests had passed separately against production with the rotated password.
- Wallet isolation/logout browser test now aborts the first logout request and injects a failed refresh. Private data disappears immediately and stays hidden until sign-out retry; a later public refresh succeeds.
- Stale snapshot responses are discarded across session transitions. Failed private-snapshot loading cannot be presented as an unlocked workspace.
- Production narrow reruns verified the public/mobile paths, human attestation and no-JavaScript reload. The broad owner-intake browser case remains intermittently interrupted by the runner's network resets. A request-metadata-only diagnostic measured a genuine 201 save in 4.8 seconds; another explicitly recorded its POST failing with ERR_NETWORK_CHANGED. No mutation retry was added. These are not counted as a clean full production suite.

No customer records, verified memories or blockchain proof were reset. No new Mainnet write, service payment or video was created.

### Final deployed privacy smoke

Application release `35d2327` was Ready. The real deployed wallet registration/isolation/interrupted-logout test **passed in 14.4 seconds**: an aborted logout hid private data, explicit retry revoked the session, a failed refresh did not restore private records, and public refresh recovered. [Sanitized evidence](evidence/production-privacy-regression.json). No owner password was used in that test.

The final production password recheck again returned old **401 INVALID_LOGIN**, rotated **200**, secure cookie flags and rejection of the logged-out cookie. The final credential audit covered **803 files and ten decoded report archives**, with zero credential matches outside the approved private environment file and zero Git-history matches. No full green production-suite claim is made; the earlier broad-run network failures remain documented.
