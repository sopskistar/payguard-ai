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
