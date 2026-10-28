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

| Service/method | Purpose |
| --- | --- |
| LedgerService/GetServiceInfo | Chain name, genesis digest and checkpoint; derive and validate Mainnet identifier |
| LedgerService/GetTransaction | Digest, sender, gas payer, effects, balance changes, checkpoint and timestamp via explicit field mask |
| StateService/GetCoinInfo | Correct coin metadata and decimals |
| StateService/GetBalance | Live spendable SUI balance |
| LedgerService/ListTransactions | Bounded candidate stream; sender or affected-address filter and opaque cursor |

[Official Tatum gRPC guide](https://docs.tatum.io/oa/reference/sui-grpc) and [Tatum method listing](https://docs.tatum.io/reference/rpc-sui). The provider may not enable every listed method on every plan. Unsupported/pruned/rate-limited operations surface an error. Incoming discovery uses affected addresses plus positive-credit filtering, not a false equivalent of legacy ToAddress. Candidate streams need a terminal frame; incomplete streams are not treated as complete history.

Run `npm run check:live` for read-only connectivity. Set optional `TATUM_TEST_DIGEST` to inspect an actual public Mainnet transaction. Diagnostics write to ignored `.data/live-diagnostics.json`. To reconcile in the app, provide the invoice's exact recipient, full coin type and explicitly agreed token amount. USD invoice values are never converted to SUI implicitly. The database prevents one digest from matching multiple invoices in the same tenant and one invoice from receiving multiple confirmed matches.

## 4. Local QA and deployment

Without Neon, explicitly set `LOCAL_DATABASE_PATH` to a local directory and leave `DATABASE_URL` empty. Run migrations and seed. This uses persistent PGlite for QA, labeled as local PostgreSQL, and disables Mainnet memory writes. Never configure this on Vercel.

For Vercel, import the repository as a Next.js project or authenticate the Vercel CLI privately. Configure the required server environment variables for the deployment environment. Do not prefix secrets with `NEXT_PUBLIC_`. Run Neon migrations before rollout. Set `APP_URL` to the deployed HTTPS origin and redeploy. Node route handlers support native gRPC; test provider connectivity from the deployed environment. Route duration is configured to 60 seconds, with shorter individual provider budgets and resumable memory polling.

Recommended deployment checks: landing/public replay; owner login; DB import/reload; live integration health; memory write completion; actual new-session recall; real digest inspection; unauthorized and cross-origin denial. No hosted URL should be announced until the deployment succeeds and these endpoints are checked.

`OPENAI_API_KEY`, `GUEST_LIVE_WRITES` and `ENABLE_AGENT_PAYMENTS` are reserved configuration only. This build uses no LLM, grants no anonymous writes and implements no supplier or optional agent payment execution.
