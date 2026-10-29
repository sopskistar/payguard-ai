import Link from 'next/link';
import { WalletEntry } from '@/components/wallet-entry';
export const metadata = { title: 'Connect Sui Wallet' };
export default function ConnectPage() {
  return (
    <div className="site-home">
      <header className="site-nav">
        <Link href="/">
          <img src="/brand/logo.png" alt="PayGuard AI" className="site-logo" />
        </Link>
        <Link href="/try" className="inline-link">
          Try without a wallet ↗
        </Link>
      </header>
      <main id="main" className="connect-page">
        <div>
          <span className="site-eyebrow">YOUR PRIVATE WORKSPACE</span>
          <h1>
            Your wallet.
            <br />
            <em>Your review history.</em>
          </h1>
          <p>
            Prove that you control a Sui wallet to create or return to an individual account. No
            email, password or funded wallet required.
          </p>
          <ol>
            <li>Connect a compatible wallet.</li>
            <li>Review the domain, address and expiry.</li>
            <li>Sign a plain-English personal message.</li>
          </ol>
          <p>
            PayGuard never asks for a recovery phrase or private key. Connection alone does not sign
            you in. Wallet sign-in does not authorize payments or grant administrator access.
          </p>
          <Link href="/app?signin=1" className="inline-link">
            Owner administrator sign in ↗
          </Link>
        </div>
        <section className="panel">
          <h2>Connect Sui Wallet</h2>
          <WalletEntry />
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
