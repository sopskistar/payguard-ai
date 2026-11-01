# Experiment 2 recovery — November 1, 2026

**Later November 1 correction:** the owner reproduced database connection errors after this release. Fresh-process probes confirmed intermittent local TCP/WebSocket/HTTPS establishment failures, including unreachable IPv6 and IPv4 attempt timeouts. The request-scoped pool change below was not a complete transport fix. [New focused recovery, evidence and owner controls](NEON_CONNECTION_RECOVERY.md).

The expired, unsigned Experiment 2 quote was cancelled once after checking the exact Neon row and the authenticated localhost resume response. No new quote, approval, wallet signature or payment was requested. Experiment 1 remains the only settled purchase. [Recovery evidence](evidence/experiment-02-recovery.json).

## Failure and cause

The original local server logged an HTTP 402 challenge followed by HTTP 500 from `/api/service-payments/d7b6a9ab-de6d-4921-ab93-09ae7763c1c7/approve`. Repeated snapshot and payment-metadata requests also failed with wrapped database/WebSocket errors. The service handler replaced unexpected exceptions with a generic failure, making a backend failure look indistinguishable from configuration or wallet failure. There is no recorded wallet request, signature or facilitator submission for this intent.

The failure was in backend access during terms approval, before payment authorization persisted. The original service handler did not retain the underlying exception, so the precise cause of that particular socket failure cannot be reconstructed conclusively. It is not evidence that Slush rejected the request. Fresh native Neon WebSocket read-only transactions and HTTP queries passed during investigation.

API requests now create and close their own Neon pool, reusing it within the request and its interactive transactions. This follows Neon's [serverless connection guidance](https://github.com/neondatabase/serverless). The previous API used a globally cached pool. The lifecycle correction avoids cross-request socket reuse; it does not establish the historical network-close reason. No database operation, approval or settlement is automatically replayed. Real authenticated snapshot, metadata, expired-intent resume and cancellation all succeeded after the change.

Unexpected errors now return bounded category/code/stage/action diagnostics. Wrapped database connection failures return `DATABASE_CONNECTION` with HTTP 503. Authentication, configuration, expiry, exposure, reservation, facilitator and Tatum errors remain distinct. Arbitrary exception text, SQL, parameters, credentials, cookies, signatures and private transaction payloads are excluded. Wallet connection/signing errors are reported only after that specific provider operation fails.

## Exact saved intent

| Field                      | Independently observed value                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Invoice                    | `X402-EXPERIMENT-02`                                                                                                     |
| Quote                      | `d7b6a9ab-de6d-4921-ab93-09ae7763c1c7`                                                                                   |
| Created                    | October 31, 21:07:56.992 UTC                                                                                             |
| Expired                    | October 31, 21:12:55.669 UTC                                                                                             |
| Before recovery            | `quoted`; no approval, prepared bytes/digest, payer, signature payload, execution digest or spending-session reservation |
| Audit before recovery      | One `service.challenge`; no signing or settlement events                                                                 |
| Recovery                   | One explicit `cancel` request returned HTTP 200; historical row retained as `cancelled`                                  |
| Cancellation audit         | November 1, 06:23:00.493 UTC; `submitted=false`                                                                          |
| After recovery             | One settled receipt, zero settling intents, 32 confirmed memory records                                                  |
| New owner session exposure | 0 / 3,000,000 MIST; other sessions' reservations are not discarded                                                       |

The quote cannot safely be resumed for signing after expiry. Read-only resume now displays that expiry and cancellation eligibility without requesting another challenge. Expired approved reservations remain included in exposure until explicit safe cancellation. Cancellation is rejected when a wallet attempt or submitted payload/digest is recorded. Uncertain payments retain their original intent and reservation.

## Current capability and provider restrictions

| Operation                                | `http://localhost:4320`                                                                     | Production                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Wallet Standard connection               | Available when the selected provider permits                                                | Available when the selected provider permits                            |
| Free personal-message registration/login | Available; server nonce/signature/session checks retained                                   | Available; no blanket Slush exclusion                                   |
| Administrator access                     | Existing owner authentication                                                               | Existing owner authentication                                           |
| Mainnet quote preparation                | Configured; fresh owner request required                                                    | Configured owner-only quoting; no signature authorization implied       |
| Unsigned transaction preparation         | Enabled after exact owner terms acceptance                                                  | Restricted by PayGuard hosted-origin policy                             |
| Transaction signing and settlement       | Enabled in the existing supervised local server; separate explicit signing click required   | Restricted by PayGuard hosted-origin policy, regardless of provider     |
| Physical provider verdict                | Earlier owner-reported successful Slush operation; no physical wallet used in this recovery | Current Slush/other-provider connection and signing verdicts unverified |

Hosted financial preparation/signing remains hard-gated by `serviceWalletSigningAllowed`: Vercel/public origins are rejected independently of wallet login. This is an application restriction, not a current observed Slush warning. The explicit local settlement switch, configured parties, dedicated payer, owner role, current spending session and 0.003 SUI exposure cap remain additional financial prerequisites. A member wallet session cannot perform owner-only paid operations.

Headless contract tests do not certify a physical extension or mobile wallet. No extension version, earlier flagged payload, browser permissions/cache or current Slush reputation response is available. The reason the localhost warning disappeared remains unproven. No warning is hidden, dismissed or bypassed. [Detailed Slush investigation](SLUSH_LOCALHOST_INVESTIGATION.md).

## Owner's next steps

1. Open [Experiment 2 on the existing local server](http://localhost:4320/services?invoice=X402-EXPERIMENT-02), using the existing owner login if needed. The old cancelled quote remains in saved history.
2. Click **Request payment quote**. Review the new five-minute HTTP 402 terms: Experiment 2 invoice, first-party report, Sui Mainnet, 0.001 SUI, existing Wallet A payer, existing Wallet B merchant, Tentacle sponsor and zero payer gas. No new funding or conversion was requested by this recovery.
3. Select the intended wallet, accept those exact terms and click **Review 0.001 SUI purchase · prepare**. This saves unsigned bytes and the reservation; it does not request a financial signature.
4. Separately click **Sign and submit in wallet** and personally review the exact Slush request. Stop at any warning or refusal. There is one submission attempt; an uncertain result must use **Resume existing payment**, never another signature/payment.
5. After confirmation, use **Verify payment and view analysis report** to reopen the saved receipt without another charge. Experiment 3 remains separately searchable at [its existing invoice link](http://localhost:4320/services?invoice=X402-EXPERIMENT-03); its saved memory comparison is unchanged.

No additional Mainnet purchase occurred. Both payer and merchant remain owner-controlled experiment accounts. No existing memory, wallet, balance or database was reset. No video was created.

## Validation

83 focused unit/integration tests pass across 13 files, covering authentication, challenge replay/binding, signature verification, protocol matching, cap/concurrent reservations, expired unsigned recovery, retained uncertain-payment reservations, pool isolation/cleanup and diagnostic redaction. The 16 focused production-build browser cases pass with zero skips, using a fresh disposable PGlite database and no live credentials. [Browser results](evidence/experiment-02-browser-tests.json).

The initial browser run passed 15 and failed one because the test's generic alert selector also matched Next.js's route announcer. The payment diagnostic was present. The selector was narrowed to the actual payment alert; the same full focused set then passed 16/16. [Preserved initial result](evidence/experiment-02-browser-tests-initial.json). No application assertion, throttle or safety control was weakened.

TypeScript, whole-repository lint, changed-file formatting, diff checks and one production validation build pass. A current-credential scan of 798 tracked/new source, evidence and browser-asset files found zero matches. No dependency or schema changes were made. Real localhost recovery passed all 12 checks, including the cancellation transaction and mobile overflow check. [Desktop](screenshots/experiment-02-recovery/desktop.png) · [mobile](screenshots/experiment-02-recovery/mobile.png), both at default 100% zoom. Physical wallet/provider approval remains an owner-operated check, not a claimed browser-test result.
