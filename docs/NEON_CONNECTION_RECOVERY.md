# Local Neon connection recovery — November 1, 2026

This is a targeted transport repair of the existing application at baseline commit `97a0e2a785224b72f960c8c60e4971b0c0683558`. Local Git, freshly fetched GitHub main and the live Vercel release matched that commit before editing. The owner's existing `.gitignore.save` was preserved. No database reset, migration, seed, wallet operation or financial signature was performed.

## Observed failure and remaining uncertainty

The owner's successful SQL Editor query establishes that Neon responded through its console. Local Node connectivity was independently intermittent: a fresh-process read-only probe passed one WebSocket transaction and failed two; HTTPS also failed. The existing app's owner-login request returned `503 DATABASE_CONNECTION`. These failures occurred outside wallet operations and also outside any long-lived application pool.

Further local tests established:

- The running Next.js child used exactly the `.env.local` database URL and owner authentication configuration. There was no shell database override. PostgreSQL returned `neondb` / `neondb_owner`, the project ID and branch ID. The branch/project identifiers are retained in the private audit; friendly console labels PayGuardAI / Primary are owner-supplied, not independently queried from the Neon control plane.
- DNS returned three IPv4 and three IPv6 destinations. Certificate-verified TLS 1.3 connections to all three IPv4 addresses succeeded. IPv6 failed immediately with `ENETUNREACH` on this WSL runtime. No proxy environment or disabled TLS verification was found.
- Failed HTTPS queries exposed `AggregateError` containing IPv4 `ETIMEDOUT` and IPv6 `ENETUNREACH`; the three IPv4 attempts could exhaust in approximately 0.8 seconds. Native WebSockets reported a network/non-101 error. Successful queries reached the genuine existing records.
- Node's default address-family attempt window was 250 ms. Later socket traces measured successful IPv4 TCP establishment around 208–231 ms after each address attempt began, leaving little margin for jitter. Both a default-window run and a 2,000 ms run subsequently passed ten read-only queries each. Sixteen alternating traced connections passed, as did 24 direct reads in groups of six concurrent connections, including both timing settings.

The confirmed failure is **intermittent local connection establishment**, with unreachable IPv6 and timed-out IPv4 attempts. A database outage, incorrect password, stale-pool-only explanation or connection exhaustion is not supported by these observations. The later default-window successes mean the longer window cannot honestly be called the sole proven cause of recovery. The underlying source of route/latency jitter is unverified. The larger window is a measured mitigation; bounded handshake recovery addresses transient connection failure directly.

The [Node networking reference](https://nodejs.org/docs/latest-v22.x/api/net.html#netgetdefaultautoselectfamilyattempttimeout) documents the default attempt window. Neon's [driver guidance](https://github.com/neondatabase/serverless) distinguishes WebSocket interactive transactions from HTTP queries. The application continues to use its existing transaction-capable WebSocket driver.

## Focused corrections

1. `src/db/neon-pool.ts` preserves the installed driver's Pool and its callback/promise acquisition contracts. If acquiring a connection fails transiently **before any application SQL is dispatched**, acquisition can retry once after 100 ms. Both failed attempts remain bounded by the existing 12-second connection timeout. Credentials, permission/capacity errors and ended pools are not retried.
2. `src/db/index.ts` uses that pool with the existing `AsyncLocalStorage` request lifecycle. It does not introduce another request wrapper. Each API request still closes its pool; transactions retain one acquired client. Unscoped command-line scripts retain their existing fallback pool, now with the same acquisition protection. Inspection found no application API route bypassing the existing wrapper; server-rendered workspace/connect pages do not directly query the database.
3. `tools/local-owner/server.ts` raises this supervised local process's family-attempt window to at least 2,000 ms and passes the corresponding Node option to Next.js. The actual Next child was checked and received `2000`. Address-family fallback, hostname/certificate verification, application credentials and URLs remain unchanged. Hosted runtime network timing is unchanged.
4. Focused pool tests verify successful bounded recovery, both acquisition contracts, persistent failure limits, no credential/capacity/permission retries and **no replay of an uncertain COMMIT/query**. The existing payment/authentication/cap/idempotency contracts remain in place.

Recovery does **not** retry SQL statements, transaction callbacks, HTTP handlers, payment authorizations, signatures, facilitator operations or uncertain mutations. If an acquired connection fails during a statement or commit, the original error remains visible and the payment must be reconciled. Persistent network failure still returns an error; this repair does not conceal an outage.

## Genuine records and owner workflow

The read-only pre-restart audit found only the original cancelled Experiment 2 quote `d7b6a9ab-de6d-4921-ab93-09ae7763c1c7`. It had no approval, payer, reservation, prepared bytes, received payload or execution digest. Experiment 1's receipt remained `68bhHRKzrQang8xohsahBQbehoZ4SjApQJ1U1Wf2ppyx`, with merchant credit 1,000,000 MIST. Neon contained one receipt, zero settling intents and 32 confirmed memories.

After restarting the same `localhost:4320` owner application, genuine owner login, snapshot, invoice retrieval, payment history and the exact Experiment 2 page passed. Three rounds of four concurrent authenticated reads passed. The quote button was enabled and local preparation/signing capability was available. The browser did not request a quote, approval or wallet event.

A second clean restart preserved that authenticated session. Another three rounds of four concurrent reads passed. The genuine read-only provider preflight returned `readyForQuotePreparation=true`, `configurationReady=true`, `sufficientlyFunded=true` and `spending=false`. Experiment 1's receipt reopened twice with the same receipt identity and exact 0.001 SUI merchant credit. Before/after hashes of all memory job identities/namespaces/blob references match, and hashes of the complete saved receipt/report contents match. Totals remain 32 confirmed memories and one receipt. [Full sanitized evidence](evidence/neon-connection-recovery.json).

These requests include intervals well beyond the pool's 20-second idle timeout. The application was not forced to suspend its Neon compute; an actual compute wake-up failure was not established. [Desktop screenshot](screenshots/neon-connection-recovery/desktop.png) and [mobile screenshot](screenshots/neon-connection-recovery/mobile.png) show the repaired local page at default 100% zoom, without overflow.

No Neon database setting, password change, new funding or coin conversion is required by the observed configuration. There is no reason to reset the database or recreate wallets. Production continues to allow provider-permitted personal-message login while restricting financial preparation/signing by its separate application policy; this local network repair does not change that policy or a physical provider's verdict.

## Regression results

- **183 unit/integration tests pass in 27 files, zero skips.** An additional real-driver probe injected one pre-acquisition failure, recovered before the first SQL statement and completed identity reads plus a read-only transaction. It used no financial function.
- **16 focused production-build browser tests pass, zero skips**, in a new disposable local PGlite database with live credentials disabled. Authentication, account isolation, expiry, capability display, mocked one-signature/one-submission and receipt persistence checks pass. [Browser ledger](evidence/neon-connection-browser-tests.json).
- TypeScript, repository lint, formatting, diff checks and one production validation build pass. Current credential scan: **644 files, zero matches**. No dependency change was needed.
- Two initial full unit runs each passed 158 tests but aborted the 25 payment-store tests during cold PGlite/WASM migration at the default 10-second setup deadline. That setup hook now uses 30 seconds, matching the existing per-test budget. The final full run passed all 183 tests; assertions, checks and financial mocks were unchanged.

The genuine Neon/browser checks above are separate from isolated financial fixtures. They prove owner access and readiness, not a new settled payment or physical-wallet provider acceptance. The exact cause of intermittent network jitter and actual compute suspension/wake-up remain unverified.

## Exact owner controls

Open [Experiment 2](http://localhost:4320/services?invoice=X402-EXPERIMENT-02), sign in through the existing owner workspace if needed, then:

1. **Request payment quote** — inspect fresh Mainnet terms, invoice identity, 0.001 SUI, existing Wallet A/Wallet B and facilitator sponsorship.
2. Accept the displayed terms, choose the intended existing wallet, then **Review 0.001 SUI purchase · prepare**. This reserves and freezes unsigned terms; it does not sign.
3. Separately choose **Sign and submit in wallet**, personally inspect the exact wallet request and stop at any warning/refusal.
4. If uncertain, use **Resume existing payment** for that same intent. After settlement, **Verify payment and view analysis report** reopens the saved receipt.

[Experiment 3](http://localhost:4320/services?invoice=X402-EXPERIMENT-03) remains a separate existing synthetic invoice with its previously recorded Memory OFF/ON comparison. Each purchase still requires fresh owner authorization. Experiment 1 must not be repeated. No video was created.
