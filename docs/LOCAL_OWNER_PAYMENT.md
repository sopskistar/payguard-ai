# Owner-operated local Mainnet purchase

**Current simplified workflow:** use `npm run owner:local:live` (the existing app, hot-loaded locally; no production rebuild). This makes signing available in the same supervised session, after exact review and before your personal wallet approval. No restart/chat round-trip is required between preparation and signing. The current four controls are **Request payment quote**, **Review 0.001 SUI purchase · prepare**, **Sign and submit in wallet**, and **Resume existing payment / Verify payment and view analysis report**. [Investigated prior attempts, saved-digest behavior and exact steps](PAYMENT_ATTEMPTS.md). No successful service receipt is claimed yet. The older read-only/restart procedure below remains an optional mode, rather than a required live-purchase sequence.

This runs the **existing PayGuard application**, API, transaction validator and Tentacle integration on `http://localhost:4320`. It uses the existing Neon owner workspace and existing Wallet A / Wallet B configuration. It is not a proxy to the flagged production signer and does not clear Slush’s Production classification. Respect any warning on localhost; never change origins, suppress a warning or switch wallets to evade a provider rejection.

The owner explicitly requested this inspected local deployment on October 31, 2026. That supersedes the earlier project-wide instruction to wait for production clearance before any local service experiment. Production Slush financial signing remains paused. A local purchase is recorded as an owner-controlled first-party Mainnet experiment, not proof that Production Slush signing works.

## Start with read-only preparation

In the existing WSL checkout, the private `.env.local` already contains database, administrator and provider configuration. The authenticated read-only check has cached the two public Production addresses in ignored `.data/owner-payment-config.json`. No wallet creation, funding or conversion is needed.

```bash
cd ~/payguard-ai
npm run owner:local
```

Open **http://localhost:4320/services#payment-setup**. Use **Owner administrator sign in** with your existing private password. This browser session is separate from Production. The launcher binds only to `127.0.0.1`, fixes the application origin, refuses hosted/CI execution, checks Mainnet providers/funds and starts with settlement disabled regardless of inherited payment flags. It never migrates, seeds, resets or automatically purchases anything.

Use **Refresh balances for both wallets and compatibility · no signing**. Wallet A must have at least 1,000,000 MIST of usable address balance. The last fresh check on October 31 showed 5,000,000 MIST; ordinary coin objects are separate. Both parties must match the full public addresses already configured. A public address alone does not establish account control.

Select an eligible **open** invoice. The selector and details identify vendor, number, status, sample/stored context and record ID. Do not pay simply to produce a digest: an invoice with no additional recipient mentions, links or bypass text is explicitly discouraged. For a synthetic experiment, label the invoice accordingly and include a contradictory recipient reference or suspicious embedded link in its memo/instruction. Human verification remains required. No synthetic scenario is a real fraud outcome.

Click **Request exact service terms**. This makes an actual HTTP 402 request; the quote lasts five minutes. Inspect every term before granting authorization. Settlement-disabled mode can connect the permitted account and prepare exact unsigned bytes after your terms checkbox. This records your approval and reserves 0.001 SUI against the session cap, but cannot request a transaction signature or settle. Cancel an unpaid reservation if you do not proceed.

## Enable capability only when personally supervising

Stop the read-only local process with **Ctrl+C**, then run:

```bash
npm run owner:local -- --enable-settlement
```

This changes only that local process. **Do not change Vercel settlement settings.** The capability flag is not transaction approval: the authenticated owner must approve each exact quote in the interface, then separately approve the wallet signature. Anonymous and member accounts cannot purchase. The existing 0.003 SUI authenticated-session cap, pending reservations, exact configured payer/merchant and replay protection remain enforced.

Keep an already-prepared page open during the restart and use **Refresh payment controls · no signing** afterward. This rereads server capability without replacing its prepared bytes or requesting any signature. It cannot override server policy. If the quote expires, cancel the unpaid reservation and review/approve fresh terms; do not sign stale bytes. Otherwise open the local page and sign into the owner workspace if necessary. Old cancelled/expired audit quotes are unusable.

1. Confirm **Sui Mainnet**, native `0x2::sui::SUI`, **0.001 SUI / 1,000,000 MIST**, Wallet A payer and Wallet B merchant, PayGuard first-party analysis and `https://facilitator.tentaclepay.com`.
2. Confirm **zero payer gas**, facilitator sponsor and **2,000,000 MIST sponsor gas budget**, **0.003 SUI session cap**, five-minute application expiry and the displayed service purpose. Sui’s signed bytes remain valid through the approved epoch window; cancellation cannot revoke a disclosed signature.
3. For the existing Google account, select **Use existing Slush web wallet**, then choose its distinct web-wallet entry in **Signing wallet**. Alternatively select the already-installed Slush account if supported. Do not create or import any wallet.
4. Check the exact-terms authorization checkbox, then **Approve terms and prepare transaction · no signature**. Slush may request an ordinary account connection; select the existing Wallet A. It must match the configured payer exactly and support Mainnet. No transaction signature is requested by preparation.
5. Expand **Inspect exact prepared transaction before signing**. It must contain only `0x2::balance::redeem_funds<0x2::sui::SUI>` and `0x2::balance::send_funds<0x2::sui::SUI>`, exactly 1,000,000 MIST from Wallet A to Wallet B, empty gas coin inputs, the declared facilitator sponsor, the approved Mainnet genesis and quote ID. Save the prepared digest; it is not settlement proof.
6. **Stop here until you approve this exact fresh purchase.** The next separate click, **Review and sign exact purchase in wallet**, opens Slush. Inspect the actual wallet transaction yourself. The sender is Wallet A; Wallet B receives 0.001 SUI; the facilitator sponsors gas. Do not approve unexpected operations, payer gas or a provider warning. Wallet rejection is allowed and never automatically retried.
7. After your wallet approval, PayGuard sends those identical bytes once through the x402 endpoint and Tentacle. It locks the digest/reservation before signature RPC disclosure. It then independently reconciles through Tatum. A signature or facilitator “success” alone is not success.
8. If pending/uncertain, use **Resume settlement check** for the same saved intent. Do not sign a replacement, repeat settlement, delete state or reset anything. Restarting with the default read-only launcher still permits reconciliation of submitted intents.
9. A real success must show the finalized Mainnet digest, checkpoint, exact positive merchant credit, receipt and useful report. Receipt, report, settled state and completion audit persist atomically in Neon. The same owner account can resume the saved intent from Production; supplier approval holds remain intact.
10. Only if useful, separately consent to the displayed minimized Walrus rule. Settlement never writes a memory automatically. Existing 32 confirmed memories remain untouched. Additional purchases each need their own quote/authorization, within the existing cap.

After the supervised attempt, **Ctrl+C** and restart without `--enable-settlement`, or close the process. Leave Vercel settlement false. Record a real digest only after independent confirmation; no successful service settlement exists in the pre-purchase release evidence.

## Regular wallet accounts

`http://localhost:4320/connect` supports deliberate Wallet Standard connection and the official Slush web account. A free, one-time personal-message challenge creates or returns to a **member** workspace; it does not grant owner rights or authorize payments. Owner Sign In remains separate. No transaction-signing action is used by login.

On Production, other permitted Wallet Standard providers may authenticate; Slush is excluded from normal sign-in while its domain review is unresolved. The separate `/connect?mode=review` remains review-only. No automatic provider connection or web popup occurs. This provider-specific UI restriction is not cryptographic provider identity verification; the actual authentication boundary is the verified account signature, origin, nonce, browser binding and tenant session.

### Official SDK metadata check

The site's CSP now permits the SDK's exact `https://api.slush.app` metadata host, matching the inspected converter's narrow allowlist. Lint, formatting and the final build pass. A genuine non-spending headless check still received **HTTP 403** from `/api/wallet/metadata`; the browser reported `ERR_FAILED`. This is not counted as a successful wallet connection or signature test. The installed official SDK retains its own built-in registration fallback on metadata failure; no custom proxy, replacement provider or warning override was added. [Actual diagnostic](evidence/oct31-slush-metadata.json). Use only the existing account through the official wallet controls; if Slush itself refuses or warns, stop and resolve that provider decision. Metadata failure does not justify disabling other product workflows or paying through another origin to evade a warning.
