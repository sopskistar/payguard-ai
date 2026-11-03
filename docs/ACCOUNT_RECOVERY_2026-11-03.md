# Account recovery and customer checkout acceptance — November 3, 2026

## Recovered checkpoint

The existing workspace was recovered before source edits. Local `main`, fetched
`origin/main`, and the live Production `/api/release` all matched
`4dacd7a49d7f1517cf8e88cb6eaf429cc38dbb02`. GitHub reported Vercel success for
deployment `2bR7RFVQDjVrXc4n36vriVcLU1Mj`; no newer branch or pull request was found.
The working tree contained eight modified demo/video documentation files, untracked
video sources and `.gitignore.save`. All were preserved and excluded from this repair.
No previous account or private chat was accessed.

The previous release had already completed the administrator/member payer distinction,
explicit workspace switch, authenticated-payer checks, ordinary-coin compatibility,
private workspaces, three historical Mainnet receipts/reports and recorded Walrus
proof. Its final acceptance expressly excluded physical Nightly financial signing.

Newer database activity postdates that handoff. There are **33 confirmed memories**:
the original 32 tuples are unchanged, plus a member correction created November 3
at 09:35:56 UTC and confirmed at 09:36:15 UTC. It has a provider job and blob ID.
All 33 provider jobs were freshly checked as done with matching blob/namespace;
none were recreated. Three receipts and three settlement submissions remain, with
zero settling intents. The full historical receipt-content hash still matches
`3d9fcb7a9e47f9d96dc53c7d59607f36a607842f4f3e70b56a45c3d4215595b8`.
Fresh Tatum Mainnet reads reconfirmed three successful 1,000,000 MIST merchant credits.

Evidence: [chain and record preservation](evidence/recovered-mainnet-preservation.json),
[Walrus provider reads](evidence/recovered-walrus-provider-check.json).

## Signing investigation and changes

Installed versions: Sui 2.38.0, dApp Kit Core 1.6.41, dApp Kit React 2.1.43,
Wallet Standard 0.21.36 and Next.js 16.4.3. The official saved Nightly package is
1.51.49 and advertises Mainnet and `sui:signTransaction` 2.0.0. The owner's currently
installed extension version has not been independently confirmed.

The original `{ toJSON }` wrapper conforms to the installed Wallet Standard input.
Both recovered transactions parse and rebuild to identical bytes/digests using both
the application SDK and Nightly's saved SDK bundle. The provider error's root cause
is **unresolved**; neither a required Transaction instance nor a wrapper violation
was demonstrated. No physical extension acceptance is inferred from this result.
[Offline serialization evidence](evidence/recovered-nightly-serialization.json).

Checkout now passes the already approved BCS string through the current
`sui:signTransaction` input, matching the installed dApp Kit's documented string-input
mechanism. Serialization/network resolution no longer occurs inside `toJSON` during
the wallet call. This is a compatibility simplification, not a proven cure for the
reported provider exception. Official references:
[Mysten signing action](https://sdk.mystenlabs.com/dapp-kit/actions/sign-transaction),
[Wallet Standard](https://www.docs.sui.io/onchain-finance/asset-custody/wallets/wallet-standard),
[Nightly signing](https://docs.nightly.app/docs/sui/sui/sign_transaction/).
Nightly's prose page still shows legacy examples; no legacy execution fallback was added.

Confirmed recovery/UI defects were repaired:

- A provider rejection no longer appears to be pending settlement. The timeline
  distinguishes declined, failed, uncertain, signed/unsubmitted, submitted and final states.
- A recorded 4001 decline can permit a separately clicked retry only after server
  reconciliation, matching the local decline/digest, same approval session, unexpired
  quote and no disclosed/submitted payload. Fresh consent and preparation reuse the
  immutable bytes. Reservations are retained and cancellation remains locked.
- Unknown provider errors, malformed/changed signing results, lost diagnostic requests
  and legacy local markers remain uncertain. Reload never requests another signature.
- Signature-return diagnostics contain a digest only. The server continues checking
  exact stored bytes, terms, signer cryptography and spend reservation before any
  facilitator verification/settlement. Diagnostics never prove settlement or release caps.
- Services separates saved paid reports from unfinished payments, provides creation
  actions and an explicit empty selector, accepts invoice IDs in review links, and
  displays workspace identity, expected payer and the connected signing account.

No migration, dependency upgrade, branding change, memory write or historical payment
mutation is part of this repair.

## Earlier intents: preserve ambiguity

| Intent                                 | Saved role/state                                    | Prepared digest                                | Application evidence                                                                                                 |
| -------------------------------------- | --------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `544d939d-02d5-4d98-b549-69fb9fb501e8` | Member, approved; quote expired 09:43:09 UTC        | `EDe8JMezpxR4qpWFiMQni6ETMdYfYXiM8Sdxnkzvse3s` | Correct supplied member payer; no durable wallet outcome or payload/submission                                       |
| `b0386342-a7c2-40ba-909e-9edf17501767` | Administrator, approved; quote expired 10:05:04 UTC | `7GiPuDNq1vN8pLn2cqJf8kYMrt9zmbdDBbAfdoYtGdRj` | Wallet requested/error: `PROVIDER_ERROR`, `Invalid type: Expected Object but received Object`; no payload/submission |

Neither digest was found by Tatum. **NOT_FOUND is not proof that a signature was
never produced.** Both transactions have `ValidDuring` epochs 1300–1301, while the
fresh chain read was epoch 1300. Quote expiry alone therefore does not make a lost
signature impossible to execute. No fourth settlement is observed; the signature
production question remains unresolved. Neither historical record was changed,
cancelled, marked failed or automatically retried. The administrator error cannot
be conclusively attributed to a particular installed provider from its saved fields.

The supplied member address currently holds 0.012446622 SUI, all address balance.
Its balance and actual selected Nightly account must be checked again before any
future owner-controlled financial approval.

## Owner-controlled acceptance checkpoint

**Do not sign either expired intent or create a replacement for an unresolved attempt.**
Keep the original browser's pending record/local marker. An operator must first
reconcile the exact original digests and any provider history. If no signed result
can be recovered, wait until the chain epoch is strictly greater than 1301 and
independently reconcile the digests again. Missing chain evidence alone must not
be represented as a failed transaction, or used to release reservations automatically.
The current repair deliberately leaves these historical reservations locked.

Once the earlier ambiguity has been resolved under server policy and the owner is
physically available:

1. Open Production `/services`. If it says Administrator checkout, use **Switch to
   wallet workspace**, select Nightly and approve only the free personal-message login.
2. Confirm the private workspace and expected payer equal the actual selected Nightly
   account, and confirm Sui Mainnet and a fresh sufficient balance. The supplied member
   account ends `c42365fa`; administrator payer ends `c96397a8`.
3. Reuse the member's existing synthetic supplier/invoice if appropriate. Do not recreate
   confirmed records. Open an existing paid report directly if one already exists.
4. For a separately authorized new unpaid review, request and inspect 0.001 SUI terms:
   merchant `0x99eac0f7be358adf9f96ce0490392f356332af96376aadf11d829a529c1a189e`,
   sponsor `0x6d8c6e978808e81344b6ddcc741b06d2b2b1106066d218683e0161f696878b61`,
   payer gas zero, sponsor budget at most 0.002 SUI, and a fresh quote expiry.
5. Prepare without signing, inspect the stored digest/transaction, then personally decide
   whether to approve the separate **Sign and submit in wallet** request. Stop at a warning
   or refusal. A generic error requires reconciliation, not another signature.
6. Only a Tatum-finalized exact merchant credit and persisted owned receipt/report establish
   success. Reopen that receipt to confirm no additional charge.

No financial approval is authorized or performed by these written instructions alone.
The original physical Nightly provider error still needs supervised reproduction or
acceptance. No video was generated or modified in this session.

## Validation and release evidence

All 218 unit/integration tests passed across 32 files. TypeScript, lint, formatting,
the final production build and a configured-credential scan (881 files, zero matches)
passed. The initial sandbox build and loopback browser startup failed on environment
restrictions; both passed outside the sandbox. The final complete disposable PostgreSQL
browser run passed 44 tests with zero failures/flakes and two deliberate live-provider
skips, including lost-diagnostics/local-marker recovery. The earlier complete run passed
43 before that additional regression. [Browser evidence](evidence/recovered-local-browser.json).

The [Production baseline integration check](evidence/recovered-production-baseline.json)
passed against recovered release `4dacd7a`, using actual HTTP routes and Neon. It
verified real personal-signature authentication and replay rejection, isolated private
workspace loading, synthetic supplier/expected-recipient/invoice persistence, actual
Agent Services selection, authenticated payer binding, foreign invoice/receipt denial,
administrator-settings denial, returning-login persistence and 360/390/430px geometry.
Two unfunded test profiles and one synthetic supplier/invoice were added; existing
customer/administrator records were not edited. The generated test signing identities
were used for free messages only; this is not physical Nightly acceptance.

The same check read an existing expired administrator intent through the actual HTTP
402 response/header and confirmed the saved Mainnet/0.001 SUI/sponsor terms, creating
no quote. It reopened the three historical reports twice each without charging.
Fresh customer HTTP 402/preparation and positive wallet settlement remain covered by
controlled fixtures and the recovered member transaction, not a new physical purchase.
Production configuration capability booleans were verified through authenticated routes;
Vercel environment-variable inventory/values were not accessible and were not guessed.

Application commit `37565fd5e35fcfbe9eab512ac8adc7547a4a3f2b` was pushed normally
and independently verified live through `/api/release`. GitHub reported Vercel
success for deployment `5FntjUtdqyCRKRqx7yRYyuaFuXM3`. All **14 actual Production
public browser tests passed**, with zero failures/skips/flakes. All seven requested
routes returned HTTP 200. [Public browser results](evidence/recovered-production-public-tests.json).

The authenticated deployed [release probe](evidence/recovered-production-release.json)
passed: old administrator provider error is `signature-failed`, quote expired,
`retryAllowed: false`, `submitted: false`; all three reports reopen; a fresh existing
Experiment 3 recall is OFF 0 / ON 7 with owned citations and baseline holds retained.
Neon remains at 33 confirmed memories, three receipts, three settlement submissions,
zero settling intents and an identical historical receipt-content fingerprint.
The first probe had a local Fetch boolean/method mistake and stopped before
authentication; its corrected run is the evidence above. No application defect or
financial operation occurred in that failed probe. [Validation ledger](evidence/recovered-validation.json).

| Customer acceptance item                    | Classification and scope                                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wallet login                                | REAL VERIFIED: Production cryptographic free-message API login/replay/returning login with unfunded generated test identities. Current physical Nightly login was not repeated. |
| Private workspace                           | REAL VERIFIED: actual authenticated Production/Neon isolation.                                                                                                                  |
| Supplier/invoice creation                   | REAL VERIFIED: one new synthetic supplier/reference/invoice through authenticated routes.                                                                                       |
| Invoice selection                           | REAL VERIFIED: browser selected that actual saved customer invoice in Agent Services.                                                                                           |
| HTTP 402 quote                              | REAL VERIFIED for an existing saved owner intent without creating a quote; fresh customer quote response TEST VERIFIED ONLY.                                                    |
| Sponsored preparation                       | REAL VERIFIED for recovered exact member/owner unsigned transactions; new physical preparation NOT TESTED.                                                                      |
| Signing compatibility/integrity             | TEST VERIFIED ONLY: offline official Nightly SDK, current Wallet Standard fixture, real disposable cryptographic signature and negative cases.                                  |
| Real Nightly extension financial acceptance | BLOCKED: requires supervised owner/provider evidence; root cause unresolved.                                                                                                    |
| Requested new blockchain settlement         | BLOCKED: no fourth payment was authorized or attempted. Original three payments REAL VERIFIED independently.                                                                    |
| Receipt reopening                           | REAL VERIFIED: original reports reopened through Production without another charge.                                                                                             |

Subsequent evidence-only commits preserve the validated application source. The local
working tree's original eight demo/video modifications and untracked video sources
remain deliberately uncommitted. No video process was run.
