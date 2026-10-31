# Verified executed purchase — October 31

The original completed purchase is now independently reconciled: quote `51d204df-71fd-44a6-ac4a-c8e0c50b4cf5`, actual digest [`68bhHRKzrQang8xohsahBQbehoZ4SjApQJ1U1Wf2ppyx`](https://suivision.xyz/txblock/68bhHRKzrQang8xohsahBQbehoZ4SjApQJ1U1Wf2ppyx), successful Mainnet checkpoint 340211024. Wallet B credit is exactly **0.001 SUI**. Wallet A paid exactly that amount and zero gas; Tentacle's separate sponsor paid 0.0001 SUI. The onchain bytes equal the persisted approved bytes. [Full credit/gas/challenge/audit/report evidence](evidence/mainnet-service-reconciliation.json).

Neon contains **one settled service receipt, zero settling intents and 32 confirmed memories** at the audit timestamp. Two authenticated resumes returned the same receipt; no settlement was resubmitted. The two historical prepared hashes below remain unexecuted attempts, not this successful transaction. The 0.0009 SUI explorer report is not the merchant's onchain balance change; the exact explorer screen interpretation remains unobserved.

`X402-EXPERIMENT-02` and `X402-EXPERIMENT-03` now exist as open synthetic invoices. [Preparation, fresh-session recall and repeated receipt evidence](evidence/payment-experiments-preparation.json). Each fresh purchase requires its own displayed terms approval and Slush signature. No new purchase has been authorized by this audit. [Current ledger](PAYMENT_EXPERIMENTS.md).

The remaining investigation below is historical and explains earlier unsigned attempts.

---

# Prepared-digest investigation and corrected live workflow

Recovered local/origin commit: `bb2bc65`, no tracked changes; `.gitignore.save` preserved. No production build, database reset, memory write, wallet creation or SUI conversion was performed in this continuation.

At **2026-10-31 14:34:53 UTC**, authenticated native Tatum gRPC verified Sui Mainnet genesis and checkpoint **340164573**. Both requested digests returned the provider's explicit `NOT_FOUND` status:

| Owner-reported prepared digest                 | Finalized Mainnet transaction | Application evidence                                 |
| ---------------------------------------------- | ----------------------------- | ---------------------------------------------------- |
| `EW7k8stgW1mbqHzpL2sN257dx7rowqd6tShi8JyMh79v` | Not found                     | No signed payload or facilitator submission recorded |
| `46K3xCB9Ed3c6vVXoxdTqHBxYB2KZaf8ymDQLam7h1CP` | Not found                     | No signed payload or facilitator submission recorded |

The old UI calculated prepared digests in browser memory and did not save them in Neon. Consequently the two hashes cannot honestly be mapped one-to-one to the old quote rows from server evidence. A `NOT_FOUND` result alone also does not prove that a wallet never signed off-platform. [Read-only reconciliation](evidence/payment-attempt-reconciliation.json).

Neon's two recent relevant quotes were **e8927b2e-d73a-4033-880c-34103018022e** (approved 14:01, subsequently cancelled) and **2da6b204-5b40-4b0a-a157-3d0136a623db** (approved 14:23, application expiry 14:27:22). Neither had a received payload hash or execution digest. There were **zero settling intents, zero receipts and 32 confirmed memories**. No `/verify`, `/settle`, signature-verification or settlement audit occurred for these attempts.

## Exact point where the flow stopped

The actual local server returned **`preparationAllowed=true` and `signingAllowed=false`**. It permitted connection, unsigned preparation and terms approval, but not the signing step. These digests were not successful execution receipts; SuiScan would not find an unsigned transaction. Both application quotes have now expired. No evidence supports blaming a Tentacle rejection or failed onchain execution for these two attempts.

## Narrow corrections

- Existing terms approval now saves the exact unsigned bytes and digest in the owned intent before any wallet signing. Subsequent approval cannot replace those bytes; signed submission must match them exactly. No database migration is needed.
- The existing API records bounded, redacted wallet/provider diagnostics and exposes prepared versus execution digests. Signed transaction bytes/signatures are never printed in diagnostic logs. The transaction bytes remain identical through Wallet Standard and x402.
- Payment progress distinguishes **Prepared → Awaiting signature → Submitted → Confirming → Settled → Report delivered**. Only actual facilitator-submission records count as submitted; only Tatum-confirmed persisted receipts count as settled/delivered. Pending or unknown results never cause an automatic retry.
- The same owner-controlled app can run in one supervised session with `npm run owner:local:live`. It uses hot development loading rather than a production rebuild, the existing database and addresses, and the unchanged 0.001 SUI price / 0.003 SUI session cap. No transaction is generated or signed merely by starting it.

## Owner action

Reload **http://localhost:4320/services**. Use the existing owner login, select the already saved synthetic **X402-OWNER-20261031-01**, then:

1. **Request payment quote.** Inspect Wallet A, Wallet B, Mainnet/native SUI, 0.001 SUI, Tentacle, zero payer gas, the 0.002 SUI sponsor budget and five-minute expiry.
2. **Review 0.001 SUI purchase · prepare.** Select your existing wallet and explicitly approve the terms. This connects the account and saves unsigned bytes; it does not sign or pay.
3. **Sign and submit in wallet.** Personally inspect and approve the exact Slush transaction. Stop if Slush warns/refuses. Signing is never automatic; PayGuard then submits those identical bytes once through the existing x402 path.
4. **Resume existing payment** to independently check the original digest if pending. After actual success, **Verify payment and view analysis report** reads the persisted receipt; it does not charge again.

The local capability switch does not clear Production Slush restrictions. Old expired quotes must not be signed. Cancel an expired unsigned quote explicitly if needed; records are retained. Do not create a replacement for an uncertain submitted digest. Any Walrus correction after a real report requires its own explicit consent.

**Current actual service settlement count: zero.** Real wallet authorization, finalized merchant credit and the actual receipt/report are still required. No video was created.
