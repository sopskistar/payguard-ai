# PayGuard Verify — Independent demo and final-release audit (2026-11-02)

This document is a non-destructive review of the owner's uploaded `payguard-verify-official-demo-4k.mp4` and the GitHub main branch as of `32f7f8255dac7f6e2f02d147912a9c5c192811d5`. It is **not** a claim of authenticated live-site acceptance and does not authorize payments, wallet signatures, changes to existing evidence, or new memory writes.

## Verified media measurements

- Duration: 165.021333 seconds (2:45).
- Video dimensions: 3840 × 2160, H.264, approximately 24.97 frames per second, reported video stream bitrate **376,447 bps**; audio AAC; embedded mov_text subtitle stream.
- File size approximately 10.89 MB. Dimensions alone do not imply high visual quality; this bitrate is exceptionally low for detailed 4K screen footage.
- FFmpeg blackdetect found a nearly completely black tail from **154.741 to 164.981 seconds**, about **10.24 seconds**. This overlaps the ending narration and should be replaced with a real closing card.
- Extracted embedded subtitle track, 2:32–2:40: “Nightly login has worked on Production. Slush's production warning remains respected. Optional checkout requires your exact approval.” These wallet-provider implementation details belong in technical docs, not the persuasive ending.
- Contact-sheet inspection showed some screens held at wide zoom with small evidence text. The intended critical points (change, hold, memory source, signed/settled proof, report) need enlarged native-quality closeups; avoid fabricated product UI.

## Editorial requirements for final cut

1. Open on the familiar-supplier / changed-recipient situation, followed quickly by the actual product performing the review. When citing the FBI's Business Email Compromise guidance, state independent verification and never imply partnership.
2. Show the supplier's original and proposed recipient **large enough to read**, the detected anomaly and retained human hold.
3. Show **authorized human correction -> confirmed Walrus Mainnet job/blob -> subsequent recalled citation -> later review**; don't imply an anonymous replay performs a fresh read if it is recorded evidence.
4. Show the Memory Courtroom OFF/ON on the same invoice. It is correct that both sides retain the hold; ON adds provenance/context, not fake approval changes. Seven citations were reported for the specific captured comparison; four fresh queries are a different measurement, not a contradiction.
5. Show the actual injection/override attempt and that it failed to change the approval hold.
6. Show HTTP 402 -> exact fee/owner approval -> executed Sui digest -> Tatum-verified recipient credit -> delivered report, with **three** original transaction identifiers, no new payment during recording.
7. State briefly that invoice scenarios are synthetic and the experimental payer and merchant are developer-controlled. No real supplier payment or verified supplier phone call took place.
8. Replace technical-wallet-provider narration at 2:25+ with strong customer entry paths, live demo, public repo/proof, and close: “Verify before you pay. Remember what nearly went wrong.” Include a readable URL/logo card through the final frame, not a black tail.
9. Favor a sharp **1920×1080, 30 fps** export with readable close-ups and sufficiently high bitrate over a 4K file that contains illegibly tiny UI or heavily compressed frames. Include aligned SRT plus burned-in accessible subtitles. Verify all exports with ffprobe and visual review.

## Source-of-truth corrections

- The current `README.md` already starts with **HOW TO TEST PAYGUARD VERIFY**, includes **32 confirmed memories** and **three settled x402 receipts**. An older claim that it still mentions 13 memories and no payments is stale; do not overwrite the current README with old copy.
- Three original confirmed Sui Mainnet service digests: `68bhHRKzrQang8xohsahBQbehoZ4SjApQJ1U1Wf2ppyx`, `xASYnWVeftLraQ2RvxMR6oPndU3r7UoBrX9Z9KPJd9r`, `4NxNL1sekFUNxpiu6ebhTtwdkT5UXnsiMsnhcPNK1tGA`.
- All three total 0.003 SUI recorded merchant credit per current repository reconciliation; distinguish actual recipient effects from a SuiVision overview showing 0.0009 SUI.
- The official Total Recall page lists Best Walrus Memory ($500) and Best Use of Agent Payments ($500). Deadline **2026-11-10 17:00 UTC**. Scoring: 30% integration, 30% technical quality, 20% creativity, 20% presentation.

## Concrete checkout defect for Codex to investigate

In `src/components/service-payment.tsx` the prepare flow chooses an account with `a.chains.includes(terms.network)`, `a.features.includes('sui:signTransaction')`, and on mainnet `a.address === dedicatedPayer`; failure raises “Select the dedicated approved payer on the specified Sui network.”

In `src/lib/service-payments.ts`, `checkoutPayer(tenantId)` returns `SERVICE_PAYMENT_PAYER` for the owner tenant, but the authenticated member address for wallet tenants. On a Nightly-authenticated Production workspace this mismatch could be session/audience selection, wrong connected account, or an account feature mismatch. Investigate by comparing safe public fields: server audience/tenant class, expected payer, registered Nightly wallet IDs, selected wallet's accounts/addresses/feature strings/network and current signed-in wallet. **Never** weaken the server-side authenticated payer binding, bypass wallet warnings, or sign/submit payments for the owner. Repair the actual cause, show meaningful user-facing guidance, and regression-test both owner and member paths, account switching, signed-message auth, and cross-tenant isolation.

Screenshots provided by the owner show a Nightly-funded wallet and the error after preparation, **not** a completed fourth transaction. No claim of Nightly financial acceptance is established. Do not claim the entire Production checkout works until a physical, explicitly owner-approved transaction settles and its receipt/report are independently reconciled.

## Documentation/UI audit rules

- Inspect latest source, Production release SHA, and docs before modifying; audit current top-level README, judge guide, live article, homepage, courtroom, /try, /proof, /connect, /services and footer.
- Fix any **outdated blanket “disabled,” “under construction,” “no x402 payments,” or “coming soon”** labels contradicted by current evidence. Keep accurate per-provider limitations and pending owner approval statements where those are actually true.
- Avoid redoing completed product architecture, rebuilding the app, overwriting 32 Walrus memories, resetting Neon, duplicating receipts or changing the three payment identities.
- Test this as a focused release and video pass. Preserve historical investigation logs clearly labeled as historical, rather than silently deleting evidence.

## Source links

- Official rules: https://thewalrussessions.wal.app/tatum-total-recall
- Event page: https://recall-tatum-walrus.vercel.app/
- FBI BEC: https://www.fbi.gov/how-we-can-help-you/common-frauds-and-scams/business-email-compromise
- Devpost demo tips: https://info.devpost.com/blog/6-tips-for-making-a-hackathon-demo-video
