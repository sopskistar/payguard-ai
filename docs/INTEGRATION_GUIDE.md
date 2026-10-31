# Setup and integration guide

## 1. Database and owner access

Create a Neon Postgres project and database. Privately put its connection string in `DATABASE_URL`. Use a migration-capable role to apply `npm run db:migrate`, then `npm run db:seed-demo` for synthetic fixtures. Deploy all migrations in order; `0001` adds Verify tables without dropping previous records.

Set `AUTH_SECRET` to at least 32 cryptographically random characters (`openssl rand -hex 32`). Set `OWNER_PASSWORD` to a unique password of at least 16 characters. Set `APP_URL` to the exact browser origin. Do not include a trailing path. Configure these privately; never send their values in chat. The public workspace stays read-only and never exposes the owner's invoices.

Sessions expire in eight hours and are stored by hash. Rotating `AUTH_SECRET` invalidates them. Login is rate-limited per owner account; live actions have separate database-backed quotas. Obtain owner demo access privately. For public deployment, use a dedicated synthetic-data workspace for judges and rotate the password afterward.

## 2. Walrus Mainnet

1. Open the [Memory dashboard](https://memory.walrus.xyz), select Mainnet, and create/manage a Memory account.
2. Authorize a delegate for that account. Store the **delegate** private key in `MEMWAL_PRIVATE_KEY`; never use the owner's spending key or seed.
3. Put the account object ID in `MEMWAL_ACCOUNT_ID`. It is distinct from the delegate's public identity.
4. Leave `MEMWAL_SERVER_URL=https://relayer.memory.walrus.xyz`. This build rejects custom/testnet relayers for Mainnet proof.
5. Optionally set `MEMWAL_AGENT_ID` to the public delegate identity requested for submission. It is not an account ID or private key.
6. Restart/redeploy. Sign in and test Settings → Integrations. Relayer health alone does **not** prove authorization or a successful write.
7. In Verify Instructions, record a correction, choose vendor scope, enable future behavior, and consent to the minimized policy payload. The detailed explanation stays in Neon.
8. Confirm the job reaches `confirmed` with both accepted job ID and blob ID. A timeout remains `pending`; resume the same job in Memory Lab. Do not write again simply because recall is empty.
9. Use Memory Lab's seed action to create/resume twelve distinct synthetic business events. It processes one job per request and uses stable operation keys. A terminal failed job is retained for investigation and never counted as confirmed.
10. Open a later invoice in a fresh authenticated browser context and recheck. ON requires a real returned memory matching the stored blob and exact approved text. OFF excludes soft policies but retains mandatory rules. Record screenshots/evidence of both outcomes.

SDK signatures were checked against installed `@mysten-incubation/memwal` 0.1.10: `remember(text, namespace, {idempotencyKey})`, `waitForRememberJob(jobId, options)`, `recall({query, namespace, limit})`. [Official usage](https://docs.wal.app/walrus-memory/sdk/usage/memwal), [API](https://docs.wal.app/walrus-memory/sdk/api-reference), [durable operations](https://docs.wal.app/walrus-memory/sdk/production-readiness).

Namespace is stable per server-authenticated owner; callers cannot choose it. Namespace alone is not authorization. Recall text is treated as untrusted and cannot invent executable rules. Credentials never enter browser bundles or logs.

Retention depends on Walrus storage epochs. Indexing can lag; recall is semantic and bounded, so a confirmed write is not guaranteed to appear in every query. The app does not implement renewal or global deletion. Invoice deletion and sample reset preserve memory and audit evidence.

## 3. Tatum Sui Mainnet gRPC

Create a Tatum Mainnet API key with Sui gRPC access. Configure `TATUM_API_KEY` server-side. The endpoint is fixed to **sui-mainnet-grpc.gateway.tatum.io:443**, native HTTP/2 gRPC with TLS and `x-api-key` metadata. There is no public fallback and no JSON-RPC transport.

Implementation uses `SuiGrpcClient` generated v2 services with `@protobuf-ts/grpc-transport` and `@grpc/grpc-js`. This avoids vendoring a partial proto tree. Signatures and protobuf fields are checked against the installed SDK source.

| Service/method                 | Purpose                                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| LedgerService/GetServiceInfo   | Chain name, genesis digest and checkpoint; derive and validate Mainnet identifier                     |
| LedgerService/GetTransaction   | Digest, sender, gas payer, effects, balance changes, checkpoint and timestamp via explicit field mask |
| StateService/GetCoinInfo       | Correct coin metadata and decimals                                                                    |
| StateService/GetBalance        | Live spendable SUI balance                                                                            |
| LedgerService/ListTransactions | Bounded candidate stream; sender or affected-address filter and opaque cursor                         |

[Official Tatum gRPC guide](https://docs.tatum.io/oa/reference/sui-grpc) and [Tatum method listing](https://docs.tatum.io/reference/rpc-sui). The provider may not enable every listed method on every plan. Unsupported/pruned/rate-limited operations surface an error. Incoming discovery uses affected addresses plus positive-credit filtering, not a false equivalent of legacy ToAddress. Candidate streams need a terminal frame; incomplete streams are not treated as complete history.

Run `npm run check:live` for read-only connectivity. Set optional `TATUM_TEST_DIGEST` to inspect an actual public Mainnet transaction. Diagnostics write to ignored `.data/live-diagnostics.json`. To reconcile in the app, provide the invoice's exact recipient, full coin type and explicitly agreed token amount. USD invoice values are never converted to SUI implicitly. The database prevents one digest from matching multiple invoices in the same tenant and one invoice from receiving multiple confirmed matches.

## 4. Local QA and deployment

Without Neon, explicitly set `LOCAL_DATABASE_PATH` to a local directory and leave `DATABASE_URL` empty. Run migrations and seed. This uses persistent PGlite for QA, labeled as local PostgreSQL, and disables Mainnet memory writes. Never configure this on Vercel.

For Vercel, import the repository as a Next.js project or authenticate the Vercel CLI privately. Configure the required server environment variables for the deployment environment. Do not prefix secrets with `NEXT_PUBLIC_`. Run Neon migrations before rollout. Set `APP_URL` to the deployed HTTPS origin and redeploy. Node route handlers support native gRPC; test provider connectivity from the deployed environment. Route duration is configured to 60 seconds, with shorter individual provider budgets and resumable memory polling.

Recommended deployment checks: landing/public replay; owner login; DB import/reload; live integration health; memory write completion; actual new-session recall; real digest inspection; unauthorized and cross-origin denial. No hosted URL should be announced until the deployment succeeds and these endpoints are checked.

`OPENAI_API_KEY` and `GUEST_LIVE_WRITES` remain unused/reserved. This build uses no LLM or anonymous writes. Supplier payments remain unavailable; the separate owner-approved Testnet service-fee feature is described below.

## Verified recovery notes

On October 28, all twelve seed jobs confirmed and a separate live browser correction brought the total to thirteen. Resume with `npm run memory:seed`; do not delete the durable jobs or resubmit successful memories. `npm run memory:prove-recall` creates a later synthetic invoice in a fresh process and writes the OFF/ON evidence. The explicit live browser test separately proves logout/new-context recall. See [the proof ledger](MAINNET_PROOF.md).

`check:live` now exits nonzero when transaction inspection is unverified, even if service health succeeded. Known-digest inspection is preferred when automatic checkpoint discovery is intermittent. Set `TATUM_TEST_DIGEST` privately or use the public digest from the proof ledger; no payment is initiated.

The repository has a Vercel GitHub status integration. A normal push may trigger deployment; verify the new commit's status and live page. The old repository homepage was 404 during inspection. If CLI deployment is necessary, authenticate Vercel locally or set `VERCEL_TOKEN` privately, then link the existing project. Configure `DATABASE_URL`, `AUTH_SECRET`, `OWNER_PASSWORD`, `APP_URL`, `MEMWAL_ACCOUNT_ID`, `MEMWAL_PRIVATE_KEY`, `MEMWAL_SERVER_URL`, and `TATUM_API_KEY` in the Vercel project. Never assume `.env.local` was transferred. Redeploy after configuration and run hosted smoke tests.

Production is public at https://payguard-ai-henna.vercel.app. Framework Preset must be Next.js. Set APP_URL to that exact origin and redeploy after changes. Check `/api/release` for the deployed Git commit. Keep the app's own owner login enabled; public access to the landing page does not grant invoice or integration privileges. The GitHub Pages article is separate from the Next.js app and is not a substitute for the working app demo.

## Judge publication and controlled service fees

`npm run judge:evidence` captures a fresh real recall of synthetic owner policies; it preserves the previous artifact if no applicable citations return. `npm run judge:publish-build` bundles the same judge component and reviewed evidence for the existing `/docs` GitHub Pages deployment. No `.env` value or provider SDK credential is included. The Next.js route remains `/try`.

Service-payment configuration and signing are described in [AGENT_PAYMENTS.md](AGENT_PAYMENTS.md). `ENABLE_AGENT_PAYMENTS` defaults off; literal `mainnet` enables the demonstrated Mainnet quote implementation, with `testnet` retained for development. Configure distinct existing public payer and merchant addresses and Tatum access for the selected network. No spending key is requested. Production settlement remains false and its financial security gate remains intact. The [owner-local application](LOCAL_OWNER_PAYMENT.md) supports an explicitly enabled supervised purchase with separate exact approval and wallet signing. Actual finalized settlement and delivered analysis must exist before claiming the bonus.

## Wallet accounts

Apply additive migration `0004` before deploying the wallet release (`npm run db:migrate`). No wallet-authentication secrets or spending keys are needed. The existing `DATABASE_URL`, `AUTH_SECRET` and `APP_URL` support wallet accounts. Keep `OWNER_PASSWORD` for administrator access. `APP_URL` must match the browser origin; preview aliases cannot sign in against a different configured origin. Use HTTPS in production.

The modern `@mysten/dapp-kit-react` and Wallet Standard select a wallet; server signature verification creates the account. Connection alone is insufficient. Each account starts empty. Supplier-first onboarding and privacy details are available at `/connect`, `/app` and `/privacy`. Browser tests exercise a registered Wallet Standard test wallet with real personal signatures; physical mobile wallet certification remains manual.

Shared operator-sponsored memory writes are globally capped by `MEMORY_GLOBAL_WRITES_PER_HOUR` (default 40, maximum 100) and per-account `MEMORY_WRITES_PER_HOUR` (default 24, maximum 100). Provider availability, quota and retention still apply. No anonymous writes exist.

### Session-version migration

Apply forward migration `0005` before deploying the password-rotation guard. The default migrator uses transactional WebSocket PostgreSQL. On a network that blocks that transport, `npm run db:migrate -- --http` uses the official Neon HTTP migrator; use this explicitly only after reviewing pending migrations for idempotence because that adapter executes statements separately. The new one-column migration is idempotent. This changes the migration transport only, not runtime database persistence.

## Mainnet service-payment quote mode

[Mainnet x402 design and gates](AGENT_PAYMENTS.md) now supports `sui:mainnet` as primary, with native SUI and full genesis verification. Additional names are `ENABLE_AGENT_PAYMENTS`, `SERVICE_PAYMENT_PAYER`, `SERVICE_PAYMENT_RECIPIENT`, `SERVICE_PAYMENT_SETTLEMENT_ENABLED`. Keep settlement disabled until security clearance and separate exact financial authorization. Migration `0006` adds session spending reservations without changing existing records. The native sponsored path requires address-balance SUI, not just coin-object holdings. No service settlement is claimed.
