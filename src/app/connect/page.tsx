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
                Create or return to your private account using a permitted Sui wallet. Connection
                alone does not authenticate you. Inspect the free personal-message challenge before
                deliberately signing; it cannot authorize a transaction.
              </p>
              <div className="notice" role="status">
                <strong>Free registration · no email, password or funds.</strong> Choose a wallet,
                prepare the sign-in message, then sign it to create or reopen your private
                workspace. Slush worked for an owner-reported localhost purchase; production
                compatibility still needs a physical-wallet retest. Stop if any wallet warns or
                refuses. Production financial signing remains paused.{' '}
                <Link className="inline-link" href="/connect?mode=review">
                  Slush warning and review instructions
                </Link>
                . No warning is dismissed by PayGuard.
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
                production financial signing remains paused. Ordinary personal-message login is
                available on the separate account sign-in page when the wallet permits it.
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
          <p>
            PayGuard never asks for a recovery phrase or private key. Connection alone does not sign
            you in. Wallet sign-in does not authorize payments or grant administrator access.
          </p>
          <Link href="/app?signin=1" className="inline-link">
            Owner administrator sign in ↗
          </Link>
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
