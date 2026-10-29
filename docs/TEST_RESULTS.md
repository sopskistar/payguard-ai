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
