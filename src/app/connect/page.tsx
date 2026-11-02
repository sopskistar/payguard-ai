import Link from 'next/link';
import { Brand } from '@/components/brand';
import { WalletReviewEntry } from '@/components/wallet-review-entry';
import { WalletEntry } from '@/components/wallet-entry';
import {
  walletOnboardingAllowed,
  slushOnboardingBlocked,
  WALLET_REVIEW_MESSAGE,
} from '@/lib/wallet-policy';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Connect Sui Wallet' };
export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const query = await searchParams;
  const signIn = walletOnboardingAllowed() && query.mode !== 'review';
  const slushBlocked = slushOnboardingBlocked();
  return (
    <div className="site-home">
      <header className="site-nav">
        <Link href="/">
          <Brand />
        </Link>
        <Link href="/try" className="inline-link">
          Try without a wallet ↗
        </Link>
      </header>
      <main id="main" className="connect-page">
        <div>
          <span className="site-eyebrow">
            {signIn ? 'PRIVATE WALLET ACCOUNT' : 'WALLET SECURITY REVIEW · PUBLIC ACCESS'}
          </span>
          {signIn ? (
            <>
              <h1>Connect Sui Wallet</h1>
              <p>
                Create or return to your private workspace with a free personal-message signature.
                Wallet login never authorizes a payment.
              </p>
              <div className="notice" role="status">
                <p>
                  <strong>Free registration · no email, password or funds.</strong> Choose your
                  wallet, inspect the sign-in message, then sign. Stop if your wallet warns or
                  refuses.
                </p>
                <p>
                  A real Slush test on November 1 displayed a malicious-website warning for this
                  production domain. Stop at that warning.{' '}
                  <a
                    className="inline-link"
                    href="https://github.com/sopskistar/payguard-ai/blob/main/docs/SLUSH_LOCALHOST_INVESTIGATION.md"
                  >
                    Provider evidence and current status ↗
                  </a>
                </p>
              </div>
            </>
          ) : (
            <>
              <h1>
                A review request.
                <br />
                <em>No sign-in. No spending.</em>
              </h1>
              <p>
                Slush Support directs domain reviews through its own warning screen. This public
                page opens the official wallet selector so you can reach that review action. Slush
                provider warnings remain authoritative. Ordinary personal-message login is available
                on the separate account sign-in page when the wallet permits it.
              </p>
              <ol>
                <li>
                  Choose Open Slush Security Review, then select the installed Slush extension.
                </li>
                <li>If Slush displays a warning, select “Flag for review” inside the extension.</li>
                <li>
                  Do not accept the connection or override the warning. Close the request after
                  submitting your review.
                </li>
              </ol>
            </>
          )}
        </div>
        <section className="panel">
          <h2>{signIn ? 'Wallet sign-in' : 'Slush review only'}</h2>
          {signIn ? (
            <WalletEntry slushBlocked={slushBlocked} />
          ) : (
            <div className="wallet-security-pause" role="status">
              <h3>Wallet security review in progress</h3>
              <p>
                No account or owner password is required. This flow never requests a signature,
                issues a login challenge, registers an account or authorizes a payment. If no
                warning appears, stop; that is not clearance. Disconnect if a wallet unexpectedly
                connects.
              </p>
              <WalletReviewEntry />
              <Link className="button outline full" href="/connect">
                Return to wallet sign-in
              </Link>
              <p>{WALLET_REVIEW_MESSAGE}</p>
              <Link className="button primary full" href="/try">
                Try without a wallet
              </Link>
              <a
                className="inline-link"
                href="https://github.com/sopskistar/payguard-ai/blob/main/docs/SLUSH_SECURITY_REVIEW.md"
              >
                Review findings and limitations ↗
              </a>
            </div>
          )}
          {signIn && (
            <details>
              <summary>Provider status and optional paid analysis</summary>
              <p>
                Slush worked for three owner-reported localhost purchases. The November 1 real
                extension test on production was blocked by Slush’s own malicious-website warning
                before connection or authentication. This is separate from free sign-in and
                financial authorization. Other provider and mobile results are documented in the
                provider report. No warning is dismissed by PayGuard.
              </p>
              <p>
                Optional Mainnet analysis costs 0.001 SUI from your own authenticated wallet, with
                exact purchase approval and a separate transaction signature. Current checkout needs
                SUI address balance; ordinary coin-object funding is not yet validated with the
                sponsored template. Sign-in itself needs no funds.
              </p>
              <Link className="inline-link" href="/connect?mode=review">
                Slush warning and review instructions
              </Link>
            </details>
          )}
          <p>
            PayGuard never asks for a recovery phrase or private key. Connection alone does not sign
            you in. Wallet login grants no administrator access.
          </p>
          <Link href="/app?signin=1" className="inline-link">
            Owner administrator sign in ↗
          </Link>
          <p className="muted">
            Your minimized learning policies use the application’s managed Walrus account. Raw
            invoices and private contact details stay in Neon. Read{' '}
            <Link href="/privacy">privacy and retention</Link>.
          </p>
        </section>
      </main>
    </div>
  );
}
