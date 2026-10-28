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

1. Final local formatting/typecheck/lint/build passed, 51 unit tests passed, and 4 browser tests passed after the latest exception and mobile changes. The separately enabled live memory browser test also passed.
2. Safe commit and normal GitHub push, then inspect the attached Vercel deployment. GitHub authentication is available; no local Vercel token/login/project link was found. The old repository homepage returned 404. Configure Vercel environment variables and `APP_URL` if missing; local configuration does not configure the deployment.
3. Hosted integration/owner smoke test after rollout. Avoid repeated failed logins; owner authentication is rate-limited.
4. Publish the completed article to the required blog destination and record its URL. Record a 2–3 minute demo video and complete the hackathon dashboard/account fields; no publishing-platform credentials or video submission exist here.
5. Verify public delegate identity for the submission dashboard (`MEMWAL_AGENT_ID`).

The narrow MVP models one active established vendor reference plus exact invoice-scoped human attestations and audit history. A generalized multi-destination registry with all five lifecycle statuses, arbitrary exception series, and automatic retention renewal remain extensions; do not claim them implemented. The public replay demonstrates seven patterns; real before/after memory is performed in the authenticated Memory Lab, not simulated in the replay.

## Environment names only

Required owner: `DATABASE_URL`, `AUTH_SECRET`, `OWNER_PASSWORD`, `APP_URL`.
Live memory: `MEMWAL_ACCOUNT_ID`, `MEMWAL_PRIVATE_KEY`, `MEMWAL_SERVER_URL`.
Live chain: `TATUM_API_KEY`; optional known public digest: `TATUM_TEST_DIGEST`.
Submission metadata: `MEMWAL_AGENT_ID`.
Optional CLI deployment auth: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
Browser QA: `E2E_OWNER_PASSWORD`, `E2E_BASE_URL`, `LIVE_MEMORY_TEST`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

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
