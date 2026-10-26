# PAYGUARD AI — SINGLE MASTER BUILD PROMPT FOR CODEX

You are the lead product engineer, full-stack developer, design engineer, blockchain integration engineer, and QA engineer for **PayGuard AI**. Build and test a complete, visually exceptional hackathon MVP in THIS GitHub repository. Do not simply generate a prototype, screenshots, or an architectural plan. Write working code, run it, fix errors, document it, and deploy to Vercel if deployment credentials/authorization are available. If a credential or external service is unavailable, implement the interface and honest unavailable state, record precisely what is blocked, and continue with everything else. Never invent live transaction confirmations, successful Walrus writes, deployed URLs, or test results.

## 0. HACKATHON AND GOAL
- Competition: **Total Recall (Tatum × Walrus)**, October 20–November 10, 2026; submission due **November 10 at 17:00 UTC**.
- Enter **Track 02: Smart Agents for Real Life**.
- Prioritize: meaningful Walrus Memory on **Mainnet**; genuinely working **Tatum Sui Mainnet RPC** integration; polished shippable product; compelling memory-before/after demo; clean repo and documentation.
- Submission requires **at least 10 successful, verified Mainnet memories**, a working demo, public GitHub repo, and a published blog article explaining usage of Walrus and Tatum plus learning over time.
- Stretch goal: **Best Use of Agent Payments**, requiring real **x402 or MPP payments settled on Sui**. Treat this as strictly optional until all core acceptance checks pass. Never claim eligibility without a verified end-to-end onchain settlement.
- Speed target: core build in 1–2 days, then 1–2 days for real integration testing and corrections. Prioritize completeness of the small vertical slice over giant feature scope.

## 1. BRAND AND PRODUCT
Name: **PayGuard AI**
Tagline: **The payment guardian that remembers.**
Hero headline: **Every payment tells a story. PayGuard remembers it.**
Supporting copy: **Review invoices, verify Sui payments, spot suspicious changes, and teach an AI guardian your payment rules — once.**
One-liner: **An adaptive invoice and payment-review agent that learns from user corrections through Walrus Memory and verifies onchain activity using Tatum Sui RPC.**
Audience: freelancers, solo founders, small teams, Web3 builders.
Product promise: most payment tools remember transactions; PayGuard remembers WHY a transaction was approved, questioned, or rejected and applies that context later.
Important: this is an **assistive review product**, not a bank, custodial wallet, anti-fraud guarantee, or autonomous payment executor. The app NEVER pays a supplier automatically. Never imply a wallet is safe merely because its address has valid syntax.

## 2. EXISTING BRAND ASSETS — DO NOT IGNORE
The user will upload these AI-generated image files to the repo before running you:
- `payguard-ai-logo.png` — horizontal logo/wordmark
- `payguard-ai-icon.png` — square transparent shield icon
Search the repository for these assets (including root, `/public`, `/assets`, etc.), preserve their original files, and copy into appropriate paths such as `/public/brand/logo.png` and `/public/brand/icon.png`. Use the wordmark in a dark hero/navigation/footer and the icon for app navigation, favicon, and PWA icon as practical. If white text is unreadable on light backgrounds, use the icon plus a CSS text wordmark on light backgrounds; do not distort the PNG. Do not create an unrelated logo. Keep generous clear space around the icon. Set useful image alt text.

## 3. VISUAL DIRECTION — PREMIUM FINTECH COMMAND CENTER
Create a memorable, tasteful, professional frontend with graceful motion. Avoid generic hackathon templates and noisy crypto dashboards.
- Design aesthetic: sophisticated midnight/navy fintech UI; soft glass layers, restrained neon mint highlights, precise data typography, high contrast, subtle radial gradients, premium hierarchy.
- Suggested tokens: background `#07121F`, surface `#0D1C2B`, elevated `#112638`, border `#1E3A4A`, text `#ECF7F5`, muted `#91A9B1`, mint `#29E1BC`, cyan `#44C8F5`, amber `#FFC46B`, danger `#FA7185`. Adjust for accessibility.
- Fonts: Geist or Manrope for UI and a restrained monospace for hashes/numbers.
- Stack for motion: `motion` / Framer Motion where stable. Animate hero reveal, card entrances, sidebar transitions, active agent states, collapsible risk rationale, animated memory flow, sparklines, numbers, and toasts. Hover lifts and soft interactive glows are welcome. Never over-animate danger information. Honor `prefers-reduced-motion`, keyboard navigation, and touch targets.
- Responsive: excellent desktop dashboard plus fully usable mobile and tablet.
- Landing page: brand nav (How it works / Features / Architecture / Launch app), high-impact hero with CTA **Open PayGuard** and **Watch it learn**, subtle animated shield/radar illustration made with CSS/SVG, interactive before/after preview, three-step workflow, live technology section, footer.
- App: left sidebar desktop / compact mobile navigation. Pages: Overview; Invoice Inbox; Review Center; Wallet Watch; Memory Lab; Activity & Audit; Settings. Bonus Agent Payments tab only when implemented.
- Dashboard: real summary cards (total invoices, needs review, duplicates, confirmed Sui payments), risk trend chart driven by actual stored invoice data, recent alerts, recent memory, watchlist, actionable 'Review invoice' and 'Run demo scenario' actions. Seeded/demo data must be visually marked as demo, never presented as real financial activity.
- Quality: skeleton loaders, clear empty/error/retry states, loading spinners, toasts, form validation, mobile drawer, meaningful keyboard focus, no dead buttons or decorative-only interaction. No excessive em-dashes or marketing filler.

## 4. TECH STACK
- Next.js App Router + TypeScript strict mode + React.
- Tailwind CSS, shadcn/ui components or Radix UI as appropriate, lucide-react, motion/framer-motion.
- **Neon Postgres** using Drizzle ORM and migrations. Use database records as the canonical source for invoices, manual approvals, wallet matches and audit trail. No in-memory-only fake persistence.
- Route handlers/server actions with `zod` input validation.
- Walrus Memory SDK: `@mysten-incubation/memwal` via server-side functions.
- Tatum Sui Mainnet JSON-RPC, requested from backend only, with `x-api-key` kept server-side.
- Choose an optional LLM provider adapter if `OPENAI_API_KEY` is set (for clear natural-language reasoning/explanations), but the core detection and memory application MUST work without any paid AI key. Never let a model autonomously make final approve/pay decisions. The deterministic risk engine is the source of truth.
- Vitest/unit tests; Playwright smoke tests if practical; ESLint + typecheck + build scripts. Prefer well-supported packages, not experimental dependencies unless required.
- Vercel hosting. No always-running background worker requirement. Support manual wallet refresh and invoice recheck; optional Vercel Cron later.

## 5. FUNCTIONAL MVP — IMPLEMENT EVERY CORE ITEM
### A. Invoice inbox and intake
- Add invoice manually using a high-quality form: merchant/vendor, invoice number, issued/due dates, amount, currency, memo, recipient Sui address (optional), token/coin type if paying in crypto, and optional related wallet address.
- Upload `.pdf`, `.txt`, and `.csv` invoices with input size/type limits and defensive parsing. Support text-based PDFs. Use a maintained server-side PDF text extractor; scanned/image-only PDFs may display **'Text not detected — enter details manually'** instead of fictional extraction. Never promise full OCR unless actually implemented and tested.
- Present the extracted fields in an editable review form; never silently fill missing values with invented entries. No raw invoice documents uploaded to Walrus.
- Persist invoice source type, extraction outcome and confidence/field-source metadata. Allow editing, deleting, status transitions and filtering.
- Include 5–8 synthetic demo invoices with realistic variants, clearly labeled **Sample data**.

### B. Deterministic invoice review engine
Implement separately testable rules with explicit `id`, evidence, severity and next action:
1. Duplicate invoice number for same vendor; near-duplicate amount/date/recipient patterns (mark near duplicates 'possible', not certain).
2. Changed recipient wallet for a previously seen vendor; address format alone is never a trust signal.
3. Amount deviation from confirmed past invoices (clearly label baseline size and confidence; insufficient history -> unknown).
4. Amount over user-set review threshold.
5. Overdue/due-soon, new vendor, missing fields.
6. Previously rejected or escalated vendor/recipient mismatch pattern based on Walrus recall.
7. Explicit user-authored hard rules: 'verify all new addresses for vendor X', 'require manual approval above Y', etc.
Outputs: `Low`, `Needs review`, `High risk / verification required`, `Insufficient evidence`. Scores must be transparent, not pseudo-scientific 'fraud probability'. A user may acknowledge/override alerts with a reason; never auto-transfer, auto-authorize payments, or label a transaction fraud without evidence.

### C. Corrections and the real learning loop (THE MOST IMPORTANT FEATURE)
- The Review Center offers: **Correct this assessment**, **Remember this rule**, **Mark confirmed exception**, **Escalate future matches**, **Dismiss with reason**.
- Correction UI captures which finding was wrong, user explanation, merchant reference, scope (this invoice / this vendor / all invoices), and whether future behavior should change.
- Before evaluating a new invoice: semantically **recall relevant memories from WALRUS MAINNET**, citing which memories informed a recommendation. Combine with current invoice and deterministic safety rules; do not rely on model hallucinations.
- When a correction is confirmed, write an abstract/minimized memory to Mainnet, await completion, store returned job/blob id and status in Neon audit table, then make it discoverable in the Memory Lab. Display `Pending`, `Confirmed`, or `Failed` accurately. If job is accepted but not finished, never display as confirmed.
- Preserve user-corrected policy/rule state authoritatively in Neon too. When showing **Memory OFF** comparison, disable retrieval/application of learned memories while keeping mandatory generic checks; when **Memory ON**, retrieve remembered incident context and learned soft policies and show rationale with memory citations. Make the incremental benefit of Walrus visible; do not fake a changed output with hardcoded UI differences.
- Store only necessary abstract patterns / pseudonymous vendor ids / approved policy text; avoid raw invoices, unnecessary personal info, secret keys or full sensitive transaction details in Walrus. Make deletion/retention limits visible and document limitations.
- Memory Lab: confirmed/pending/failed count, audit timeline, semantic recall search, provenance labels, link to related review, used-for-decision badge, explicit Memory ON/OFF comparison, and a 'Mainnet proof' panel displaying verified blob id/account id where available.
- Build an authenticated admin-only **Seed 12 demo memories** action using genuinely different synthetic business events (approved recurring bill, rejected address change, different threshold, duplicate, known false positive, vendor-specific rules, etc.). The button must actually call Walrus for each item and await completion (with reasonable concurrency limits/retries), track successes, show errors and allow idempotent resume. **Do not populate fake success counters**. Must show >=10 confirmed Mainnet memories for the submission.
- Critical demo: baseline with Memory OFF -> issue with vendor payout-address change -> user provides a correction and persists it through Walrus -> a second related invoice in a new browser session -> Memory ON recalls the correction and escalates/explains based on the actual retrieved memory -> toggle OFF to expose baseline difference. All records and statuses real within the demo dataset.

### D. Tatum Sui wallet watch and payment reconciliation
- Add and remove watch-only Sui addresses (no private keys, no seed phrases). Validate Sui address format, labels, and deduplicate.
- Via server-side Tatum Mainnet RPC, query live SUI balances and transactions. Use documented supported methods including `suix_getBalance`, `suix_queryTransactionBlocks` and `sui_getTransactionBlock` with `showEffects`/`showBalanceChanges` as applicable. Verify exact method signatures against current docs during coding; handle pagination, rate limits, RPC failure, and provider changes.
- Mainnet URL: `https://sui-mainnet.gateway.tatum.io`; protect `TATUM_API_KEY`. Provide a connection health test and a 'Last refreshed' timestamp. Display real chain identifiers and explorer links built from validated digest/network, not fake tx hashes.
- Let user attach a real tx digest to an invoice and click **Verify payment**. Independently fetch chain data and check: successful status, intended recipient's positive balance change for the correct token, the token's decimal units, amount expected, correct network, and uniqueness of match. Avoid misreading gas fees as transfers. No double-matching the same digest; use idempotency and conflict statuses. If invoice amount is USD and tx is SUI, do NOT assume an exchange rate; require explicit agreed token amount/price source or mark reconciliation `Needs review`.
- Wallet watch may suggest candidate transactions, but mark `Candidate`, `Confirmed match`, `Mismatch`, or `Unverified` honestly. If RPC fails, show an informative offline state, not demo data disguised as live.
- Build a **Transaction Inspector** pane showing digest, chain, sender, relevant balance changes, recipients, timestamp/checkpoint when available, verification criteria and external explorer link.

### E. Explainable agent and audit
- Agent overview/panel: **Why PayGuard flagged this**, **Which memories influenced this**, **What it checked onchain**, **What the human should do next**.
- Deterministic findings must be legible without the LLM. If LLM enabled, summarize only facts passed in; never invent blockchain facts or declare something safe.
- Immutable-ish append-only activity events (DB audit log): import, finding, correction, memory write request/completion, recall application, verification, override and confirmed settlement. Protect against deletion through UI.
- User settings: currency preference, review threshold, allowed tokens, alert preferences, demo state and reset sample data.

## 6. MEMORY INTEGRATION SPECIFIC INSTRUCTIONS
Official references:
- https://docs.wal.app/walrus-memory/sdk/usage/memwal
- https://docs.wal.app/walrus-memory/sdk/api-reference
- https://docs.wal.app/walrus-memory/sdk/cookbook-multi-tenant
- https://memory.walrus.xyz
Implement server-side `MemWal.create({ key: process.env.MEMWAL_PRIVATE_KEY, accountId: process.env.MEMWAL_ACCOUNT_ID, serverUrl: process.env.MEMWAL_SERVER_URL ?? 'https://relayer.memory.walrus.xyz', namespace: computedNamespace })`.
- Prefer `rememberAndWait(text, namespace)` if current installed SDK supports it, or `remember()` then `waitForRememberJob(job.job_id)`; verify actual installed signatures rather than guessing.
- Use `recall({ query, namespace, limit })` and record which returned items informed the evaluation.
- Account object ID and delegate key are DIFFERENT; `MEMWAL_AGENT_ID` in the hackathon submission refers to the delegate key's public identity from the Memory dashboard, NOT the private key or account object id. The user will enter it manually.
- `MEMWAL_PRIVATE_KEY` is the authorized DELEGATE PRIVATE KEY (not the Sui owner seed). Never expose it to client, telemetry, repo or logs.
- One stable server-generated namespace per authenticated user/demo tenant. Do not let caller pass an arbitrary namespace or choose another tenant. Docs warn namespace alone is not an authorization boundary.
- SDK relayer may index asynchronously and memory has retention epochs; implement confirmation and transparent recall retry, and document that memory is not permanent without renewals.
- If credentials missing, show **Integration not configured** and disable live memory actions, not local-memory 'proof'.

## 7. AUTH AND PUBLIC DEMO SAFETY
- Deliver a usable zero-friction **public guided demo** of the screens with seeded synthetic invoices, clearly labeled. Avoid requiring judges to own SUI for the basic experience.
- For live memory WRITES, admin seeding, settings and sensitive edits, use server-verified authenticated access (an owner login from securely stored credentials or a properly implemented wallet-signature auth with nonce and session). Do NOT expose all user records and private Walrus access via an open `/api/memory` route.
- Optional guest live writes only if safely rate-limited and quota-restricted, with server-created session and unique namespace. Default to disabled if proper isolation/quotas are not ready. Document how judges can view the proof and obtain a valid interactive demo without putting passwords in the public repo.
- Validate inputs, limit uploads, verify owner/tenant on every route, add abuse limits to paid and memory operations, safe CORS, CSRF-aware sessions, no server logs of full private invoices.
- No wallet seed phrase or private spending key ever accepted for a supplier payment. Sui wallets are watch-only by default.

## 8. OPTIONAL BONUS: REAL SUI x402/MPP AGENT PAYMENTS, AFTER CORE WORKS
Only start when all above MVP criteria and build/test checks pass. Time-box this module. The feature: user explicitly approves a small fixed-price payment for an external specialist document-check API. The agent should discover a real payment challenge, show exact asset/network/recipient/amount, obtain explicit approval, have a wallet sign exact terms, settle on Sui Mainnet, validate the receipt using Tatum, then deliver the paid analysis and persist an auditable receipt.
- Reference starting points: https://github.com/DrVelvetFog/x402-sui-stack and https://github.com/DrVelvetFog/sui-x402-facilitator and https://github.com/x402-foundation/x402 . These are third-party/example integrations; audit docs, support and security before use.
- Do NOT assume official `@x402/sui` is published. Check compatibility and prefer an actually working, verified v2 Sui flow. If third-party service/SDK is unworkable, skip bonus and document the blocker.
- If using our own paid API endpoint as demonstration, clearly call it a first-party experimental paid service, not a third-party paid provider. It must actually implement a standards-aligned payment challenge / verify / settle and settle a real low-value Sui transaction (not just a `402` UI), with replay protection, server-owned fee terms, receipt, and confirmation. No hidden payment, no auto approval, no mainnet private key in public repo, no transactions above explicit user cap, never retry a previously settled payment as a new one.
- Treat receipt verification and duplicate settlement protection as non-negotiable. If no actual valid Sui mainnet payment is completed, label tab **Experimental / Not connected** and do NOT claim the bonus in README or submission.
- This module must NEVER delay, replace, or destabilize the memory and Tatum MVP.

## 9. DATA MODEL
Use sensible indexed tables with foreign keys and tenant ownership: `users`, `sessions` (as auth library requires), `vendors`, `invoices`, `invoice_files` (metadata only where feasible), `watched_wallets`, `payment_candidates`, `payment_matches`, `risk_findings`, `review_decisions`, `user_rules`, `memory_jobs`, `memory_recall_events`, `audit_events`, `demo_scenarios`, and `agent_payment_receipts` (bonus only).
- Invoice + vendor history is canonical in Neon, not written only into AI prompts.
- Every memory job stores `job_id`, `blob_id` if confirmed, namespace/tenant reference, intent, status, created/completed timestamps and error (redacted).
- Add idempotency/uniqueness constraints to invoice imports, digest matching and seed event ids. Use database transactions where appropriate.
- Keep schema understandable and documented. No fake payment rows in production tables that could be mistaken for verified blockchain events; sample rows have `is_demo` flag.

## 10. KEY VISIBLE DEMO EXPERIENCES
Implement a `Demo Lab` entry point (can be within Memory Lab) with three guided scenarios:
1. **Payout switch:** a familiar merchant submits an invoice to a new Sui recipient. Generic rule warns. User records 'For this merchant, ALWAYS require independent verification on recipient changes.' Store Mainnet memory. A later related invoice explicitly cites the recovered rule, escalates, and displays why.
2. **Duplicate billing:** two near-identical invoices. Show deterministic duplicate warning, user correction, saved pattern and its relevance on subsequent invoice.
3. **Onchain payment:** attach a real Sui Mainnet digest entered by the user and use live Tatum to evaluate token, recipient, amount and confirmed status. If no real digest supplied, show a clear 'Paste a mainnet digest to verify' instruction and synthetic preview labeled sample — never fabricate a 'verified' payment.
Provide a visual **Before memory / After memory** switch with side-by-side reasoning. The ON side must derive from real recalled memory; the OFF side cannot use those recalled records. Demo state should survive reload via Neon + session, within authorization boundaries.

## 11. READINESS AND DEBUG TOOLS
- Admin-only `/app/settings/integrations` showing Neon, Walrus relayer, confirmed Mainnet memories and Tatum endpoint statuses, plus redacted troubleshooting details. Never reveal any API key.
- `.env.example` with the following placeholders and accurate comments: `DATABASE_URL`, `MEMWAL_PRIVATE_KEY`, `MEMWAL_ACCOUNT_ID`, `MEMWAL_SERVER_URL`, `TATUM_API_KEY`, `OPENAI_API_KEY` (optional), authentication/session secret(s), app base URL, guest/demo write limits, and optional payment feature flag. No actual secrets committed.
- Scripts: `dev`, `build`, `typecheck`, `lint`, `test`, `db:generate`, `db:migrate`, `db:seed-demo`, and `test:e2e` if created.
- Create `docs/INTEGRATION_GUIDE.md` explaining the dashboard setup and env variables step by step, and `docs/DEMO_SCRIPT.md` for an excellent 2–3 minute video.
- Create `docs/HACKATHON_ARTICLE_DRAFT.md` (publishable outline with accurate implementation notes and placeholders for real proof links) and `docs/MAINNET_PROOF.md` (actual confirmed memory job/blob IDs, Memory account ID and at least one real Tatum response or tx evidence; no invented proofs).
- README with tagline, product problem, features, architecture, screenshot placeholders until genuine screenshots exist, env setup, migrations, running locally, demo instructions, test commands, Mainnet proof, security caveats, deployment guide, live demo URL only if known, and technology acknowledgments.
- Add concise architecture diagram (Mermaid is fine), CONTRIBUTING notes and an honest limitations section.

## 12. EXECUTION ORDER — DON'T STOP AT PLANNING
1. Inspect actual repository and uploaded brand assets; keep any existing user work. Create Next.js architecture and brand theme.
2. Set up Neon + Drizzle schema/migrations and demo records; running local app is required.
3. Build polished responsive landing/dashboard UI with navigation and real forms.
4. Implement invoice intake, review rules and audit trail; verify unit tests.
5. Implement Walrus server client and durable correction -> write -> confirmed job -> recall -> new evaluation loop. Build Memory Lab and Admin seed tool; test with real Mainnet credentials if supplied.
6. Implement Tatum RPC wallet watch, transaction inspector, invoice verification and network failure states; test real response if supplied.
7. Make all pages real, handle empty/error/loading, mobile and reduced motion.
8. Run actual `npm install`, migrations, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`; fix issues. If possible run browser smoke tests and check console/network errors.
9. Only after green core: investigate and attempt x402-on-Sui bonus. Stop it if unstable.
10. Document verified proofs and setup, commit code, and deploy to Vercel when credentials allow. Do not fake deployment. Verify Vercel build and route endpoints where accessible.

## 13. ACCEPTANCE CRITERIA — REQUIRED BEFORE 'DONE'
- [ ] High-quality responsive landing + app pages with real working navigation, forms and motion (reduced motion supported).
- [ ] Neon DB persists invoices/decisions through reloads; sample data clearly identified.
- [ ] Manual invoice intake and genuine text parsing for at least one sample PDF; safe manual edit fallback.
- [ ] Duplicates, changed recipient, amount threshold and prior corrected incidents identified by testable deterministic rules.
- [ ] User submits a correction and a **real Mainnet** Walrus `rememberAndWait` (or equivalent) finishes, yielding real proof, without fabricated counters.
- [ ] The next related invoice triggers genuine Walrus semantic recall; Memory ON/OFF changes explanation/response for explainable reasons. New session test passes.
- [ ] At least 10 distinct Mainnet memories confirmed by SDK and recorded with proof before final hackathon submission.
- [ ] Live Tatum Sui mainnet query succeeds using secret server-side key; app can inspect a real digest and accurately report match/mismatch/unverified.
- [ ] No supplier payment automation, unauthorized sensitive writes or secret leaks.
- [ ] Integration diagnostics make missing keys and RPC downtime understandable.
- [ ] Test/typecheck/lint/build all pass (report any exceptions clearly).
- [ ] README, architecture, setup instructions, 2–3 min demo script, article draft and proof document exist and are honest.
- [ ] Bonus claims made only if a genuine, onchain settled Sui x402/MPP paid API call is proven.

## 14. COMMUNICATION WITH REPO OWNER
Work autonomously and proactively. Do not request preferences already specified in this prompt. Do not pause simply to give a roadmap; build the features. When blocked ONLY by secrets, external dashboard registration, payment approval, or deployment permissions, ask for the smallest precise manual action while finishing all unblocked work. Do not show or request private key values in a public chat or issue. At each milestone, briefly report completed code, commands run and next steps. At completion provide:
1. What really works versus what remains limited.
2. Exact `.env` variables/credentials that the owner must privately configure.
3. All terminal commands for setup and testing.
4. Actual integration test output / proof references and any known errors.
5. Real deployed URL if deployment succeeded.
6. A precise list of high-priority fixes for owner/assistant to test together.

Build **PayGuard AI** now. Remember: the centerpiece is not the dashboard. It is a verifiable cycle of **invoice -> review -> user correction -> confirmed Walrus Mainnet memory -> recall across sessions -> improved review**, reinforced by real Tatum onchain evidence. Ship that exceptionally well.
