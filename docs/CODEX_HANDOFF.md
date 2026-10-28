# Current continuation — read this first

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
