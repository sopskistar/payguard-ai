# Wallet A: unsigned 0.005 SUI self-deposit review

**No conversion has been signed or submitted. This document grants no transaction approval.** Both existing owner wallets and Production settings are preserved. Production wallet signing remains paused. No service purchase has settled.

Local and fetched GitHub HEAD were both `02b6d969303a31f30db8b3694060b0bfc455b67b`, with no tracked changes or unpushed commits. The pre-existing untracked `.gitignore.save` remains untouched. This task adds a separate loopback review utility; it does not change PayGuard payment, database, memory or wallet-policy code.

## Supported method and native Slush limitation

Mysten's [address-balance guide](https://www.docs.sui.io/onchain-finance/asset-custody/address-balances/using-address-balances) explicitly supports converting existing coins by calling `0x2::coin::send_funds<0x2::sui::SUI>` with one's own address. Slush's current [user tour](https://slush.app/guides/slush-tour) documents Send, Receive, Swap and Buy/Sell, but does not document a dedicated coin-to-address-balance conversion option. A native conversion button in the owner's installed version has **not been verified**. Do not assume an ordinary Send or self-send uses address balances; do not submit one speculatively. If Slush exposes an explicit conversion preview, inspect its exact commands, amount, recipient and gas before preferring that native flow.

The fallback uses the installed official `@mysten/sui` **2.38.0**, explicit real owned SUI coin references and Wallet Standard. The existing Slush web adapter **1.3.6** is declared as a direct development dependency; no package version was upgraded. Mysten documents that the [extension/mobile use Wallet Standard and the web wallet needs its adapter](https://sdk.mystenlabs.com/slush-wallet/dapp). The adapter's inspected default origin is `https://my.slush.app`. Google login remains inside Slush. No CLI signer, key export, wallet creation or custody migration is required or provided.

The local tool is independently inspectable and cannot sign or submit. It is not a reputation-clearance claim or a replacement deployment for PayGuard. If Slush warns about this tool or the production origin, stop. Do not override, suppress or evade the warning. Actual physical Google-account signing remains untested.

## Genuine unsigned simulation — October 30, 2026

At `2026-10-30T17:22:09.915Z`, Tatum and the official Sui Mainnet endpoint agreed on Wallet A's balances. Tatum checkpoint **339849081**; official checkpoint **339849090**; Mainnet genesis `4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S`. Native SUI has 9 decimals. Simulation had checks enabled and used a real owned gas coin, **not mocked gas**. See the [sanitized evidence](evidence/self-deposit-preview.json).

| Wallet A (native SUI) | Observed before | Expected after simulated conversion |
| --------------------- | --------------: | ----------------------------------: |
| Coin objects          |     0.027993344 |                         0.022893245 |
| Address balance       |     0.000000000 |                         0.005000000 |
| Total                 |     0.027993344 |                         0.027893245 |

Exactly **5,000,000 MIST** changes custody form at the same address. Only gas reduces the total. Estimated gas is **100,099 MIST (0.000100099 SUI)**: computation 100,000 + storage 988,000 − rebate 987,901. The proposed gas budget is **2,000,000 MIST (0.002 SUI)**, paid by Wallet A, with no sponsor. At that full cap at least **20,993,344 MIST (0.020993344 SUI)** would remain in coins. Actual fees may differ. This conversion needs no additional funding under the observed snapshot. It does not fund Wallet B.

The operation has exactly two commands:

```ts
const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(5_000_000)]);
tx.moveCall({
  target: '0x2::coin::send_funds',
  typeArguments: ['0x2::sui::SUI'],
  arguments: [coin, tx.pure.address(walletA)],
});
```

Sender, destination and gas owner are bound to the complete Wallet A public address from the private, previously authenticated Production configuration snapshot. There is no editable destination or amount. One actual SUI gas coin was sufficient; its remainder stays an owned coin. The tool deliberately avoids automatic coin intents, full-balance migration and address-balance gas withdrawal. It does not include Wallet B. Building freezes gas price, budget, object version/digest and epoch expiration. Canonical BCS equality rejects any additional command or changed term.

The **unsigned**, unexecuted transaction digest is `6MXocsgenJghaAG5J7AAE9FqAEdkhrkjXgq13SiuBnMP`; it is not a successful on-chain transaction. SHA-256 of the reviewed BCS: `6cd20f7766bd11869c93ac8c090fb8c2863389d2b8b453fb7b9c086580d69bce`. On-chain expiration: epoch 1297. The review snapshot expires after 15 minutes and must be regenerated before a later approval; do not treat this dated evidence as current execution permission.

## Owner clicks for this review stage

1. In Ubuntu WSL, open `~/payguard-ai`. Run `npm run sui:deposit:preview` to refresh the unsigned simulation. This command uses the existing server-side Tatum credentials and reads only; it cannot sign or submit. It reads the already-recovered public configuration from `.data/production-payment-parties.json`. Do not enter wallet secrets or change Vercel.
2. Run `npm run sui:deposit:review` and leave that terminal open. Open **http://localhost:4318** in the desktop browser that has your existing Slush account. The server binds only to `127.0.0.1`. If already running, the server must be restarted after regenerating a preview because it serves a frozen snapshot.
3. Compare the complete address under “Sender, destination and gas owner” with Wallet A's address inside Slush. Use **Copy Wallet A address** if helpful. Check **0.005000000 SUI**, native SUI, Sui Mainnet and the gas cap. Inspect “Decoded unsigned transaction” and the simulated balance table.
4. For the extension, click **Find Slush extension**, then **Connect existing Slush account**. For the web wallet, click **Use official Slush web wallet**. The official adapter opens Slush at `my.slush.app`; keep the existing Google login and select Wallet A. A connection/account-access request can appear. Exact wallet button labels vary by version. This stage must not request a transaction or personal-message signature. Cancel if one appears.
5. The local page must report **Wallet A matches exactly**, Mainnet support and whether sign-only capability is advertised. An account mismatch stops the check. Advertised capability is not proof that this Google account can successfully sign; connection is not proof of control. If a security warning appears, stop and resolve it legitimately.
6. **Stop here.** The Sign button is deliberately disabled. Review the exact terms with ChatGPT and explicitly authorize only this 0.005 SUI self-deposit and its gas cap if you choose. A stale preview, altered gas/recipient/amount or changed object references needs a fresh review.

After exact owner approval, a separately reviewed signing step can request Wallet Standard `sui:signTransaction` from this same account on `sui:mainnet`. Slush should display its transaction review (a Move call/contract interaction, sender, amount and estimated network fee); the deposit might not look like an ordinary outgoing transfer because sender and recipient coincide. Expand details and confirm `coin::send_funds`, native SUI, 0.005 SUI and the Wallet A recipient. Wallet UI wording and zkLogin/proof prompts cannot be certified without the actual account. Never substitute a different account, use Sign-and-Execute as a silent fallback, or approve an opaque/changed transaction. The present tool contains no signing or broadcast call, and no active Mainnet signing step has been enabled.

## After an approved conversion — independent reconciliation

Keep the approved `.data/sui-self-deposit/preview.json`; do not regenerate it after signing until reconciliation is complete. Preserve the actual digest even if a wallet response is uncertain. Do not submit a second conversion to “retry”.

`npm run sui:deposit:verify -- ACTUAL_DIGEST` is a prepared **read-only** native Tatum verifier. It checks Mainnet identity, the exact approved digest/BCS, successful finalized checkpoint, actual gas and refreshed coin/address/total balances. It writes an exclusive local receipt, separate from service receipts. Unexpected balance deltas (for example intervening account activity) are flagged for investigation; they are not fabricated as success. This verifier has not been run against a genuine conversion because none was authorized or executed.

The updated address balance must independently reach at least **1,000,000 MIST** for the existing 0.001 SUI service. The proposed 0.005 SUI conversion would exceed the 0.003 SUI authenticated-session purchase cap, but does not authorize any purchase. Refresh PayGuard's read-only Payment Setup check after reconciliation. Only after all checks pass may quote preparation be considered with `ENABLE_AGENT_PAYMENTS=mainnet`; keep `SERVICE_PAYMENT_SETTLEMENT_ENABLED=false`. Both flags remain false now. Slush security clearance, a legitimate physical-wallet retest and separate exact service-purchase approval remain required for funded x402 settlement.

## Validation boundaries

The unsigned build and Mainnet simulation are real. Local Wallet Standard connection fixtures are simulated; they never sign or execute. Native Slush conversion UI, actual Google-account signing, funded conversion, post-conversion Tatum reconciliation and x402 settlement are **not passed tests**. No database writes, memory creation, owner-session changes, environment changes or video are part of this tool.

Local validation: **134 unit/integration tests passed across 20 files**, including 11 new conversion-invariant tests. Lint, TypeScript, formatting and the production build pass. [Browser checks](evidence/self-deposit-browser.json) cover 1280/360/390/430px at 100% zoom, matching/mismatching Wallet Standard fixtures, zero signing/execution calls, absent execution endpoints and foreign-origin/Host rejection. The [initial browser failure](evidence/self-deposit-browser-first.json) is preserved: a long unsigned identifier overflowed on mobile; wrapping was corrected and the complete rerun passed. [Desktop capture](screenshots/self-deposit/unsigned-1280.png) · [390px capture](screenshots/self-deposit/unsigned-390.png). Wallet address is masked in published captures; exact matching uses the private local snapshot. To reproduce, start the review server then run `npm run sui:deposit:check-browser`; optionally set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` for an existing Chromium installation.
