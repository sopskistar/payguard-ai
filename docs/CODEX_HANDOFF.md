# Current continuation handoff — Sui Mainnet implementation

This section supersedes historical checkpoints below. Started from e9781c2 with only the preserved untracked `.gitignore.save`. Do not remove that backup. No reset, force push, credential output or video.

Mainnet exact x402 now supports full genesis, native SUI 9 decimals, 1,000,000-MIST exact fee, 3,000,000-MIST authenticated-session cap, 2,000,000-MIST sponsor budget and zero payer gas. Mainnet is primary; development Testnet remains. Durable additive migration 0006 applied to Neon. Signing and settlement remain independently disabled; hosted Slush pause cannot be overridden by environment. Tentacle actual support and Tatum chain/coin preflight passed; no funded signature or settlement occurred. Dedicated SERVICE_PAYMENT_PAYER and SERVICE_PAYMENT_RECIPIENT are missing; exact financial approval is not ready. The owner already submitted Slush review; wait for outcome only for security-paused physical workflows, continue other engineering.

Original 30 memories preserved and provider-reconfirmed. Two new controlled tenant accounts each confirmed one real sponsored Mainnet correction, logged out/returned, and recalled it on a later synthetic invoice. Both-direction API authorization passed. Total tracked confirmed records: 32, of which 30 remain the original owner collection. See two-tenant-mainnet-memory.json and two-tenant-provider-recheck.json. Never rerun `prove-tenant-memory.ts` to create more copies; it refuses an existing ignored proof state. Recheck uses `recheck-tenant-memory.ts --http`, with no writes. Ephemeral fixture keys were never stored. Controlled loopback/provider proof does not certify physical hosted wallets.

Local browser 14 passed / 3 intentional skips. Hosted HTTP/1.1 run improved to 12 passed / 1 transport failure / 3 security-paused wallet skips; retain failures until the final deployed rerun. HTTP/2 diagnostic had real JS/font network resets, whereas HTTP/1.1 public probe loaded all five routes. No TLS or wallet safety was disabled. See current TEST_RESULTS and RELEASE_STATUS for final validation.

Review/payment details: AGENT_PAYMENTS.md, mainnet-service-preflight.json, mainnet-http-challenge.json. Read-only proof `/proof#isolation` now explains 30+2 records. Updated article source remains docs/index.html. No final submission form or video should be created.

---

Payment follow-up: claim the durable digest before `/verify` as well as `/settle`, retain the cap on rejected/interrupted verification, and do not allow cancellation after disclosure. Sui timestamp expiration is unsupported; the UI distinguishes the five-minute application quote from the current/next-epoch signed chain lifetime. This is an explicit approval risk, not a fake five-minute onchain guarantee.

Final UI guard: VerificationPanel binds context to invoice/mode/trust revision/edit revision; old state is hidden while fresh context loads, and attestation is disabled. Browser regression holds the actual context request to prove this. Public Refresh waits for its real initial snapshot. No-JavaScript judge checks use their own browser; 3 repeated judge files passed 9/9. Per-file diagnostic registration records pending resource paths/statuses with no secrets. Preserve failed hosted ledgers and publish the final result honestly.

## Historical handoffs follow

# Active security gate — Slush domain review

The owner now reports Slush's malicious-website warning on production `/connect`. Hosted wallet onboarding and new service-payment approval/signing/settlement are intentionally paused in page/API code. There is no environment bypass; controlled loopback fixtures remain enabled. `/try`, read-only proof and password-based owner administration remain working paths. Do not override wallet protections, switch domains/wallets to evade them, or declare the site safe from an exact-list check. `SLUSH_SECURITY_REVIEW.md` contains primary sources, recorded script hashes/headers, limitations and a ready review request for the owner to submit via official Slush support. No physical extension was available to reproduce/clear the report.

The judge now disables its controls before hydration and offers a native Reload walkthrough path. Its no-JavaScript regression and all seven steps pass locally; static GitHub Pages judge assets were rebuilt from the same component. A separate diagnostic captured 13 public asset ERR_NETWORK_CHANGED failures before any login POST. Hosted broad runs remain 7 pass / 5 fail / 3 intentional skips; do not claim all green.

Last application commit is e607f99, deployed to Vercel and GitHub Pages. Focused hosted checks: 4 pass (native readiness/reload, guest service denial, honest Refresh, wallet pause) / 3 fail (Chrome internal-error navigation), zero skips. Broad runs remain 7/5/3. Node production APIs passed all core checks on f5de472; e607f99 changes only judge readiness and test recovery. Do not claim full hosted browser green or enable wallet onboarding. Fresh integration proof is in production-core-smoke.json and provider-recheck.json; browser failures in browser-transport.json and production-browser-summary.json. Owner support-review action is fully prepared in SLUSH_SECURITY_REVIEW.md. No financial signature/settlement occurred, no new memory was written, and no video was made.

Latest local checks: 93 unit tests / 15 files pass, lint/typecheck/build pass; isolated local browser suite 13 passes and 3 explicit skips. CTA spacing is 20px with mobile stacking. Unpaid service quotes now cancel durably; approval state changes use compare-and-set. Mixed SDK candidates are filtered against exact tenant-owned proof even when both tenants have jobs. All thirty genuine owner Mainnet memories remain preserved. No memory/payment write was performed for this checkpoint. Production checkpoints 7128c11 and f5de472 passed credential-safe core API verification, live owner-session recall and Tatum reads; the broad browser run was 7 pass / 5 fail / 3 intentional skips with transport/timeouts retained. Fresh old/new password and session-version guards passed. SDK job recheck confirmed all 30 blobs. The 18-case genuine-recall report is 18/18, with 0 false / 0 missed holds. See RELEASE_STATUS.md and the newest evidence files; older deployed fixture successes below do not prove physical Slush onboarding. Preserve `.gitignore.save` and all ignored secrets/evidence.

---

# Final verified checkpoint

Application release `35d2327` is pushed and Vercel Ready. The final deployed wallet-isolation/interrupted-logout/private-cache test passed (14.4 seconds); evidence/production-privacy-regression.json records the scope. Latest production credential recheck: old password 401 INVALID_LOGIN, rotated password 200, Secure/HttpOnly/Strict session, logout 200 and revoked cookie rejected. Legacy and superseded owner-session guards also passed on production. No additional credential configuration is requested. All 30 confirmed Mainnet memories remain preserved; live production recall and Tatum inspection passed in the broader run.

Latest checks: 83 unit tests passed; lint, TypeScript, formatting and build passed; isolated local PostgreSQL QA 12 browser tests passed with two explicit live-provider skips. Production has documented ERR_NETWORK_CHANGED interruptions and no single clean full 14-case run; do not erase that limitation. The final deployed privacy regression is green. Safe workspace/Git audit: zero configured credential matches, including ten decoded report archives. `.env.local` is intentionally excluded. The original conversation history cannot be erased through project cleanup; the previous credential is no longer accepted on production.

Code, docs and sanitized evidence are checkpointed; preserve untracked .gitignore.save. Never print passwords or private keys, recreate memories, reset Neon, force-push, or create video. Optional agent-payment settlement is still unproven; needs a controlled Testnet merchant/signer setup and explicit terms approval. Mainnet spending remains disabled and requires separate exact authorization.

Earlier chronological handoffs below remain for provenance.

---

# Latest continuation checkpoint — session privacy and transport recovery

The rotated password and old-password rejection are verified on production, as are legacy/superseded-session denial. No credentials are printed or committed. The latest frontend immediately hides private data on a logout attempt; if server sign-out fails it stays locked behind Retry sign-out. Failed post-logout refresh cannot restore private records. Snapshot generations discard late responses from an older login/session. Login distinguishes authentication success from workspace-load failure. Read-only network failures get one bounded retry; mutations/payments are never automatically retried. A missing explicitly selected invoice no longer silently falls back to another invoice.

Final local validation of this change: 83 unit tests across 13 files; lint, TypeScript, formatting and production build passed. Isolated PostgreSQL QA passed 12 browser tests with the two real-provider tests explicitly skipped (32.6 seconds). The wallet browser case injected both an aborted logout and a failed refresh and verified that private data stayed hidden until retry. Earlier production live Walrus recall, Tatum inspection, wallet login/isolation and seven-step judge tests passed. Production's remaining full owner-intake browser case is intermittently blocked by ERR_NETWORK_CHANGED; a diagnostic observed auth 200, invoice 201 in 4.8 seconds and cleanup, while another captured the invoice POST itself failing with ERR_NETWORK_CHANGED. Do not claim a single clean full production browser suite. Diagnostics stay ignored under .data. Do not retry writes to hide the network problem.

All 30 confirmed Mainnet memories and proof are preserved. No payment or new memory write was sent. Payment bonus still needs merchant/Testnet signer configuration and actual settlement; Mainnet requires separate exact approval and remains disabled. No demo video is authorized. Preserve .gitignore.save and ignored .env.local; never print either password.

Earlier dated checkpoints and evidence below remain for provenance.

---

# Current verified state — security rotation resolved

Production deployment `c92f608` picked up the owner's rotated configuration: the previous password now receives 401 INVALID_LOGIN; the distinct current password receives 200, creates an authenticated owner session with Secure/HttpOnly/Strict cookie, and its cookie is rejected after logout. No values were displayed or persisted by the check. [evidence/password-rotation.json](evidence/password-rotation.json) and [evidence/session-rotation.json](evidence/session-rotation.json) contain only status/boolean proof. The deployed guard rejected a temporary legacy session and a superseded-version session (private API 401), accepted the restored current version, and removed the test session. No additional password rotation is currently requested.

All 80 unit tests pass. Lint, TypeScript, formatting and production build pass. Final isolated local PostgreSQL QA passed 12/12 applicable browser tests with two live-provider cases explicitly skipped. Production's broad 14-case run passed actual live Walrus recall, Tatum inspection, wallet login/isolation, judge flow, credential clearing and Refresh; five cases failed on network resets/timing. Three of those passed focused reruns after improving response waits and owning the verification fixture. The remaining owner UI stall exposed controls available before hydration; current frontend adds an explicit loading/native-reload state until handlers exist, and landing memory buttons wait for readiness. Validate those two cases after deploying the loading fix; do not invent a single clean 14-test production run.

The artifact audit includes decoded report ZIPs: zero current/previous password or configured credential matches in project artifacts and Git history; `.env.local` is the intentionally excluded private credential file. A synthetic failing canary verified redaction of console output, attachments, step titles and the decoded HTML archive. Original conversation history is outside repository cleanup scope; the obsolete credential is rejected by current Production. Existing Mainnet proof remains 30 records, and no new memory or payment was sent.

Optional agent-payment settlement remains unproven. Needs private ENABLE_AGENT_PAYMENTS and SERVICE_PAYMENT_RECIPIENT setup plus a controlled funded Testnet wallet and explicit displayed terms approval. Mainnet is disabled; no supplier payment path exists. Physical mobile wallet certification and external security audit remain manual/future work. No video is authorized.

Older chronological notes below are preserved, including the initial deployment mismatch that the fresh deployment resolved.

---

# Security continuation — October 29 UTC

The owner rotated OWNER_PASSWORD in .env.local and reports rotating Production. The first actual production comparison still accepted the previous diagnostic credential (HTTP 200) and rejected the distinct new local value (401). No values were printed or copied into project files. There is no Vercel token/tool authorization; force a new GitHub deployment and recheck before asking for dashboard correction. Safe evidence is in evidence/password-rotation.json. The previous credential is read only in memory from this thread's immutable historical diagnostic for the authorized rejection test; never copy it into a file or response. Project-generated diagnostics were removed. The original conversation history cannot be erased through repository cleanup.

Session-version guard added to auth.ts: all owner sessions bind a keyed HMAC credential version and fail after password rotation; wallet sessions remain independent. Migration 0005 applied via official Neon HTTP adapter because local WebSocket transport failed while SELECT over HTTP succeeded. Two additional owner test sessions were revoked using HTTP after failed WS cleanup. Existing thirty memory records/evidence remain untouched. Login form resets submitted passwords. Playwright automatic DOM snapshots/trace/screenshots/video are off; the first reporter redacts known credential values in errors/text attachments before console/HTML embedding. Unit coverage includes rotation and redaction.

Audit evidence scans project artifacts and Git history for old/new passwords and configured credentials: zero matches outside the deliberately excluded .env.local. Do not claim the production rotation resolved until the real old/new comparison passes. Continue local/public/wallet QA independently; local PostgreSQL QA is explicitly distinct from Neon/Mainnet evidence.

---

# Current continuation — October 29 UTC release

Continue this repository; never restart, reset Neon, delete the 30 confirmed memories or force-push. `.gitignore.save` is an untouched untracked owner backup. No demo video may be generated, captured or published.

The public Vercel URL is https://payguard-ai-henna.vercel.app/ and `/try`. Owner fixed Framework Preset to Next.js and set Production APP_URL correctly. The pre-release production audit verified real browser/public access, owner login, Neon snapshot with all 30 confirmed records, and actual provider health calls for Walrus and Tatum. The new release exposes `/api/release` to match Vercel's Git SHA; verify it after pushing.

Release `f26f5a7` was pushed and Vercel reported Ready. The implementation preserves baseline `49e4cfd`: redesigned branded landing, guided seven-step judge with sticky Next/Back, honest Refresh states/timestamp/errors, public/individual/admin/proof modes, read-only `/proof` with Mainnet receipts and measured learning report, modern Mysten Wallet Standard login and supplier-first onboarding. Additive migration `0004` was applied to Neon; it changes the default role to member, adds a unique wallet identity and one-time challenges. Existing owner role and evidence remain intact. See `WALLET_SECURITY.md` for domain/browser/nonce/expiry/signature/session/role/tenant boundaries and limitations. No spending keys were introduced.

Actual live learning evaluation: four real SDK recalls reused across 18 synthetic cases. The initial run found three false alarms (15/18 contracts met). Correcting learned address comparison to the established supplier reference produced 18/18, with 18/18 baseline findings retained, zero added critical warnings on four unchanged controls, no stale/wrong-scope application. Both artifacts are preserved; 10.9% candidate/case applicability is explicitly not a semantic precision score. No new memory writes, retention renewals or payments were performed.

Current local validation: lint, typecheck, 77 unit tests and production build passed. The wallet HTTP authorization/persistence browser test passed. The Wallet Standard UI test passed with real personal signatures and a test wallet that rejects any transaction-signing call. Refresh loading/success/injected-failure/retry passed. Final complete local suite passed 12/12 including live providers. Post-push production evidence is recorded in evidence/production-release.json when completed; do not infer deployed success from an absent artifact.

Payment status: exact capped first-party Testnet analysis pilot remains administrator-only and fixture-tested. Fresh facilitator `/supported` response is HTTP 200 for Sui exact v2; this is not settlement. Production is missing pilot setup names `ENABLE_AGENT_PAYMENTS` and `SERVICE_PAYMENT_RECIPIENT`, and a controlled compatible Testnet wallet/signature test. No settlement receipt exists. Mainnet is disabled in code, and any real-value payment requires explicit approval of network, asset, amount, recipient and purpose.

Commands: `npm run memory:preflight` (read-only; `--publish` refreshes sanitized evidence), `npm run memory:evaluate-learning` (four real read-only recalls), `npm run judge:publish-build`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`. Browser uses installed Chromium via PLAYWRIGHT_CHROMIUM_EXECUTABLE; LIVE_MEMORY_REUSE=1 avoids a redundant Mainnet write. Credentials stay ignored in `.env.local`, never print values. All existing production auth/Neon/Walrus/Tatum variables were configured by the owner; no new wallet-login credential is required.

Historical handoff below is retained for provenance; its old deployment-protection and single-owner descriptions are superseded by this section.

---

# Current continuation — read this first

Code release `aaf0ceb` is pushed. GitHub Pages judge is LIVE and hosted-smoke-tested at https://sopskistar.github.io/payguard-ai/try/; its bundle matched the locally tested artifact. Vercel reported the same code release Ready, but its project alias still requires login. See `docs/evidence/hosted-judge-smoke.json`. The following documentation-only checkpoint preserves this verified status.

Continue the existing repo; no reset or res scaffold. The owner explicitly forbids creating or recording any demo video. Maintain only written outlines.

The `652a397` baseline was reverified. Original 13 jobs were confirmed through SDK status; bounded expansion added 17 unique sponsored policies. **30 memories confirmed, zero pending/failed.** No Mainnet payment or renewal transaction was sent. Provider receipts and live quality results are in `docs/evidence/`. Four supplier reviews retained baseline checks and applied relevant policies; stale/wrong-scope application and added critical control warnings were zero.

New functionality: account-free `/try` judge journey using the production gate/rules and real recorded recall/Tatum proof; the same component is published as GitHub Pages `/try/`. Positive human verification expires at 30 days; edits/revisions invalidate it; missing onchain recipients and invoice directives enforce a hold.

Controlled first-party x402 v2 service analysis is implemented behind owner authentication at `/services`. It is disabled by default, Testnet-only, capped at 1,000,000 Testnet MIST, wallet-signed only after explicit terms approval, uniquely claimed before settlement, independently verified by Tatum, and stored in separate receipt tables. Additive migrations `0002`/`0003` have been applied to Neon. No funded-wallet settlement was performed; no bonus completion is claimed. Required configuration names: `ENABLE_AGENT_PAYMENTS`, `SERVICE_PAYMENT_RECIPIENT`, existing `TATUM_API_KEY`, auth/Neon variables. Never request secrets in chat. Mainnet cannot be enabled by environment alone and requires separate exact financial authorization plus code review.

The existing Vercel alias still redirects to Vercel login and the old homepage returns 404. Pending owner question: Vercel project Settings → Deployment Protection → make intended Production public and supply its domain. Keep PayGuard's owner login on. GitHub Pages article and public judge use the existing public Pages hosting. Verify hosted routes after deployment.

Release checks: 63 unit tests, TypeScript, lint, formatting and production build passed; 8/8 complete browser tests passed, including real read-only Tatum and existing-correction cross-session Walrus recall. The exact static judge bundle passed separately on desktop/mobile. A final authenticated POST-only regression also passed. Dependency audit is zero vulnerabilities. No settled service payment or verified public Vercel owner flow is claimed.

Read `docs/JUDGE_WALKTHROUGH.md`, `docs/MEMORY_EVALUATION.md`, `docs/AGENT_PAYMENTS.md`, and the final section of `docs/TEST_RESULTS.md` for exact status. Preserve `.gitignore.save` as an untracked owner backup, `.data` and `.env.local` as ignored. Do not re-run the live memory test with a new write unnecessarily; `LIVE_MEMORY_REUSE=1` verifies existing corrections across sessions.

Commands: `npm run memory:preflight`, `npm run memory:evaluate`, `npm run judge:evidence`, `npm run judge:publish-build`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. `memory:expand` is dry-run unless `--execute`; total durable-operation cap is 30 and existing IDs are reused.

---

# PayGuard Verify handoff

Continue this repository. Do not reset, re-scaffold, delete migrations, discard `.gitignore.save`, or force-push.

## Preserved checkpoints

- `aa50aa0`: initial application preserved before Verify work.
- `d353aa1`: Verify application, tests, docs and live integration work preserved after credential-value scan.
- `ae089f4`: safely merged updated GitHub specification (`2da6944`); retained implemented README and application.

The updated 207-line master specification was read in full. The source has been formatted for review. Current working changes and the final commit are listed by `git status`/`git log`; do not assume this checkpoint list is the latest head.

## Verified core

Neon migrations/seed work. Twelve distinct seed memories and one browser correction are confirmed on Mainnet. Fresh-process recall and a fresh authenticated browser-context recall passed. Tatum native gRPC read real Mainnet service identity, checkpoint, transaction and coin metadata; an unrelated transaction correctly failed invoice matching. No funds were sent and no live positive supplier payment is claimed.

Evidence lives in `docs/MAINNET_PROOF.md`, `docs/evidence/`, and `docs/TEST_RESULTS.md`. `.data/` contains private runtime exports and diagnostic scripts and must remain ignored. Real environment credentials are in ignored `.env.local`; never print them.

## Remaining gates at this checkpoint

1. Final local formatting/typecheck/lint/build passed, 51 unit tests passed, and 4 browser tests passed after the latest exception and mobile changes. The separately enabled live memory and live Tatum browser tests also passed.
2. Code/evidence are committed and pushed (`10ec793`), with article publication added in `3d64889`. Vercel reports build success. Both project aliases redirect to Vercel login; the old repository homepage is 404. The pending owner question asks for public production access and its exact URL. No local Vercel token/login is available to change protection. Do not claim public deployment is verified.
3. Once the owner exposes the production URL, confirm Vercel environment variables and `APP_URL`, then run public/authorization/owner/provider smoke tests against that URL. Local tests and Mainnet proof passed separately.
4. The technical article is published at https://sopskistar.github.io/payguard-ai/ (GitHub Pages, HTTP 200). The owner will separately arrange the demo video and complete hackathon submission/dashboard details; Codex must not create or record video. No video or completed event submission is claimed.

5. Verify public delegate identity for the submission dashboard (`MEMWAL_AGENT_ID`).

The narrow MVP models one active established vendor reference plus exact invoice-scoped human attestations and audit history. A generalized multi-destination registry with all five lifecycle statuses, arbitrary exception series, and automatic retention renewal remain extensions; do not claim them implemented. The public replay demonstrates seven patterns; real before/after memory is performed in the authenticated Memory Lab, not simulated in the replay.

## Environment names only

Required owner: `DATABASE_URL`, `AUTH_SECRET`, `OWNER_PASSWORD`, `APP_URL`.
Live memory: `MEMWAL_ACCOUNT_ID`, `MEMWAL_PRIVATE_KEY`, `MEMWAL_SERVER_URL`.
Live chain: `TATUM_API_KEY`; optional known public digest: `TATUM_TEST_DIGEST`.
Submission metadata: `MEMWAL_AGENT_ID`.
Optional CLI deployment auth: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
Browser QA: `E2E_OWNER_PASSWORD`, `E2E_BASE_URL`, `LIVE_MEMORY_TEST`, `LIVE_CHAIN_TEST`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

## Recovery commands

```bash
git status --short
git log -5 --oneline
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run proof:export
npm run memory:seed
npm run memory:prove-recall
TATUM_TEST_DIGEST=os1iG8zow278c6hqxbuyxnvMUjzThsD8GTY8atdfzW6 npm run check:live
```

Seeding is idempotent: confirmed jobs return without rewriting; accepted pending jobs resume their exact IDs. Do not create duplicates to bypass an indexing delay. A stale lease can last 120 seconds. Provider/Neon interruptions occurred; later resumptions succeeded without changing credentials or inventing evidence.

Local production server may still run on port 3000 from validation. Stop only the owned process if restarting. `.gitignore.save` remains an intentionally preserved untracked user backup. `.env.local` and editor swap files were never staged.

## Production release verification

`evidence/production-release.json` verifies commit `f26f5a722dd46a068797f42c925b9108f4085d80`: actual owner browser login, Secure/HttpOnly/Strict cookie, Neon persistence across logout/new session, all 30 records, actual SDK recall with seven owned applied citations versus zero OFF, baseline preservation, Tatum Mainnet checkpoint `339250059` and genuine digest mismatch. No writes/payments were sent. Production wallet registration/isolation HTTP test passed; the UI signed-message/account-switch test also passed in an earlier deployed run. Repeated browser runs encountered intermittent `net::ERR_NETWORK_CHANGED` on Next's main-app runtime and fonts, proven by a public-asset-only diagnostic; this is the test environment's network interruption, not missing variables. Wallet loading now includes a native reload form usable even when runtime loading fails. Re-run production browser smoke after this small follow-up. No new owner secrets are needed.

## Credential-safe diagnostics follow-up

A failed local browser diagnostic included the entered OWNER_PASSWORD in its generated DOM snapshot, and inspection exposed it in tool output. The owner was told to rotate OWNER_PASSWORD privately in Vercel Production and .env.local. Never repeat the value. The generated ignored reports were removed; no credential was committed. The login form now resets the password input immediately after reading it. Playwright automatic DOM snapshots are disabled via PLAYWRIGHT_NO_COPY_PROMPT, and trace/screenshots/video are explicitly off. Preserve this safeguard. The last complete green local run was 12/12; the later 13-test rerun was stopped after transient local database/provider failures. Report that distinction honestly. Production owner/Neon/Walrus/Tatum evidence already passed and is preserved. Further owner checks should use the privately rotated value after configuration; public and wallet checks can continue independently.

Owner session revocation succeeded: 21 administrator sessions removed; no private business records changed. OWNER_PASSWORD rotation remains an owner action in Vercel Production and ignored .env.local; do not request its value. Do not re-use the old value for more browser checks. Production follow-up nine-test attempt returned six passes and three failures (a direct ERR_NETWORK_CHANGED navigation, a snapshot timeout and a landing interaction timeout); retain this as interrupted/failed evidence, not nine passes. The new password-clearing regression uses only a synthetic intercepted request.
