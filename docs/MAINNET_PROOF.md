# Mainnet proof ledger

**Status: NOT YET VERIFIED. Submission gates are incomplete.**

No live Walrus write/recall, real Tatum authenticated response or deployed URL was available when this document was created. Synthetic tests and local PostgreSQL migrations are not Mainnet evidence. No job IDs, blobs or transaction digests are invented here.

| Requirement | Evidence |
| --- | --- |
| Memory account on Mainnet | Awaiting owner configuration |
| Public delegate identity | Awaiting `MEMWAL_AGENT_ID` |
| At least 10 completed Mainnet memories | 0 verified during this engineering session |
| Accepted job and completed blob IDs | None yet captured |
| Recall in a new authenticated browser session | Not yet live-tested |
| Memory OFF/ON decision difference based on returned citation | Covered by mocked tests only; live gate pending |
| Tatum Mainnet native gRPC service identity/checkpoint | Adapter implemented; authenticated live evidence pending |
| Real transaction inspection/reconciliation | Awaiting a real digest and configured provider |
| Public deployment | No verified URL |
| Agent payment bonus | Not implemented or claimed |

## Capture actual evidence

1. Configure the variables in the integration guide privately.
2. Run `npm run check:live` and preserve the actual output from `.data/live-diagnostics.json`.
3. In the owner app, submit a correction and seed/resume distinct synthetic-event memories. Count only `confirmed` jobs with blob IDs. A synthetic business event may produce a real Mainnet memory; the event and the storage evidence must be labeled separately.
4. Create the later sample invoice, sign out, open a fresh browser context, sign in and run OFF/ON. Capture the exact returned citation and finding difference. Do not count a local policy lookup as Walrus recall.
5. Run `npm run proof:export`. Inspect the ignored JSON for actual job/blob/account identifiers, recall events, decisions and verified transaction digests.
6. Publish only reviewed identifiers/evidence in this document; avoid private correspondence, contacts, credentials and unnecessary financial data. Complete the table with actual timestamps and links, never examples.

Relayer health is not delegate authorization. SDK job completion proves the reported write/index result, not permanent retention. An explorer link by itself is not invoice reconciliation.
