# October 31 current setup

Both existing public wallet addresses are already configured and match the authenticated Production values. Keep them unchanged. Actual Mainnet quote mode is enabled; Production settlement remains false. Wallet A has 0.005 SUI usable address balance and needs no additional conversion/funding. [Fresh read-only evidence](evidence/oct31-readiness.json). Open `/services#payment-setup` for current balances.

The [owner-operated local application](LOCAL_OWNER_PAYMENT.md) supports a separately supervised purchase using the same payment implementation and Neon records. It defaults settlement false, supports exact unsigned preparation, and requires explicit local capability plus each fresh owner/wallet approval before financial submission. Production Slush clearance remains unresolved. No genuine service purchase is recorded yet. Historical configuration instructions below do not mean either existing address should be replaced or configured again.

---

# Configure the two existing owner wallets

**Current owner state:** both existing public addresses are already configured in Vercel Production. Keep them unchanged. The balance-check correction and current evidence are in [BALANCE_CHECK_FIX.md](BALANCE_CHECK_FIX.md). Both quote/settlement switches remain false. The instructions below are reference, not a request to repeat setup.

Both wallet accounts already exist. Use Wallet A as payer and Wallet B as merchant. No wallet creation, private key, recovery phrase, automated funding or account conversion is part of this setup.

Open [Owner Sign In](https://payguard-ai-henna.vercel.app/app?signin=1), then **Agent Services → Payment Setup**, or go directly to [private Payment Setup](https://payguard-ai-henna.vercel.app/services#payment-setup). Anonymous users and member accounts cannot read the setup API. The screen displays public addresses only after administrator authentication, plus credential-presence statuses with values hidden.

## Vercel configuration

Open the existing `payguard-ai` project in Vercel → **Settings → Environment Variables**, selecting **Production**. Review the existing entries before changing anything. Preserve database, authentication, Tatum and Walrus credentials.

| Name                                 | Initial value                             | Meaning                                              |
| ------------------------------------ | ----------------------------------------- | ---------------------------------------------------- |
| `SERVICE_PAYMENT_PAYER`              | Your existing Wallet A public Sui address | Pays the first-party service fee; never a key        |
| `SERVICE_PAYMENT_RECIPIENT`          | Your existing Wallet B public Sui address | Receives the fee; must differ from payer and sponsor |
| `ENABLE_AGENT_PAYMENTS`              | `false`                                   | Quotes disabled during setup                         |
| `SERVICE_PAYMENT_SETTLEMENT_ENABLED` | `false`                                   | Settlement disabled; leave this value unchanged      |

Use `0x` followed by 64 lowercase hexadecimal characters. Reject zero, shortened, malformed or identical addresses. Compare each complete address in the corresponding wallet. An address is shared across Sui networks; entering one cannot prove Mainnet selection or ownership. The application verifies Mainnet genesis separately. Account-control verification remains incomplete while signing is paused.

Save, then open **Deployments → current production deployment → Redeploy**. Environment changes apply to new deployments, not the existing one. [Vercel environment-variable documentation](https://vercel.com/docs/environment-variables).

Return to Payment Setup and select **Refresh balances and compatibility · no signing**. This checks Tentacle's advertised sponsorship, Tatum's Mainnet genesis, native SUI metadata, address-balance gas feature, and both configured accounts' native balances. Errors leave balances unknown; they do not imply zero or success. The timestamp/checkpoint identifies a snapshot; refresh before any later purchase.

After configuration, usable funding and non-spending checks pass, quote preparation can be enabled with the literal **`ENABLE_AGENT_PAYMENTS=mainnet`**, followed by another production redeployment. `true` is not a supported quote-mode value. Keep **`SERVICE_PAYMENT_SETTLEMENT_ENABLED=false`**. Preparing a quote is not authorization, and no environment variable bypasses the Slush security pause.

## Which account to fund

Use **Wallet A**, the complete payer address displayed privately in Payment Setup, after comparing it with your existing wallet and selecting **Sui Mainnet** there. The screen can display an address-only QR after that comparison. Wallet B remains the merchant receiving address. Do not use example/test addresses from code or screenshots.

The first service costs **0.001 native SUI = 1,000,000 MIST**. The proposed first-experiment usable funding target is that amount, less any existing usable address balance. Do not treat the **0.003 SUI authenticated-session exposure cap** as a funding request or permission for three purchases. The selected service transaction uses sponsored gas: sponsor budget **2,000,000 MIST**, payer gas cap **0 MIST**.

Tatum shows **total balance**, **coin-object balance**, and **address balance** separately. This sponsored template withdraws only address-balance funds. Receiving a normal wallet transfer might create coin objects, which are insufficient for this template even if the displayed total exceeds the service price. [Sui address-balance guide](https://www.docs.sui.io/onchain-finance/asset-custody/address-balances/using-address-balances).

If funds are coins, stop and review a separate owner-controlled conversion to address balance. Sui's documented `coin::send_funds` can deposit a coin into an address balance, including the same owner address; that preparatory transaction has its own sender, destination, amount and fees. Its gas is not covered by the service's zero-payer-gas promise. No conversion is prepared or executed by PayGuard. Do not send additional funds merely because the usable balance is zero; first inspect both balance categories and actual fee requirements with ChatGPT and your wallet.

## Security clearance and first purchase

Slush Support's acknowledgement of possible false positives is **not clearance**. Hosted signing remains hard-paused in application code. Do not bypass the warning, change domains to evade it, or use the public review connector for signing. Legitimate clearance, any required remediation, and a controlled unfunded physical-wallet retest must precede a code change reopening production signing. No such reopening is included here.

Only then prepare a fresh exact purchase for an owned anomalous invoice. Review payer, merchant, Mainnet genesis, native SUI, 0.001 SUI amount, first-party provider, exact quote URL, Tentacle sponsor, 0 MIST payer gas, 0.003 SUI session exposure, purpose, expected report and expiry. **Stop before signing and obtain new explicit owner approval for that quote.** A five-minute application quote does not revoke signed bytes: the chain window extends through the next epoch.

Settlement must happen once. Lost or ambiguous responses require reconciliation of the original digest, never another payment. Success requires finalized exact merchant credit through independent Tatum inspection, a durable Neon receipt, and delivered useful analysis. Current authentic service settlement count: **zero**.
