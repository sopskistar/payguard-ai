import Link from 'next/link';
export const metadata = { title: 'Privacy and retention' };
export default function Privacy() {
  return (
    <main id="main" className="connect-page" style={{ display: 'block', maxWidth: 800 }}>
      <Link href="/">← PayGuard Verify</Link>
      <h1>Your records and your wallet</h1>
      <p>
        Wallet sign-in proves control of a signing account. It does not prove a person’s identity,
        supplier identity or authority to send payments. Your public wallet address identifies your
        Neon profile. Session cookies expire after eight hours; a personal-message challenge expires
        after five minutes and is usable once.
      </p>
      <h2>Private business records</h2>
      <p>
        Invoices, established supplier contacts, human attestations, settings and audit records stay
        in Neon. Every workspace API derives ownership from the authenticated server session. The
        application operator manages the database and integration credentials; this is a custodial
        application service, not end-to-end encrypted personal storage.
      </p>
      <h2>Walrus policy memory</h2>
      <p>
        Only with your explicit consent, fixed minimized policy templates and pseudonymous supplier
        references are written through the operator-managed Walrus Memory account. Raw invoices,
        free-text explanations and private contacts are not uploaded. The server requires a matching
        confirmed tenant-owned blob and policy before recall can affect a review. Namespaces are
        routing aids, not the access-control boundary.
      </p>
      <p>
        Mainnet blob retention is governed by the storage provider. Deleting an invoice does not
        erase a Walrus blob or its audit history. Do not submit confidential material to a public
        hackathon service. There is no self-service account deletion/export yet; arrange retention
        requests with the project owner through the repository.
      </p>
      <h2>Payments</h2>
      <p>
        Supplier payments are never sent. The separately gated first-party Testnet analysis-service
        pilot has no proven settlement and no enabled Mainnet spending path.
      </p>
      <p>
        <Link href="/connect">Connect a wallet</Link> ·{' '}
        <Link href="/try">Use synthetic practice without an account</Link> ·{' '}
        <a href="https://github.com/sopskistar/payguard-ai">Source and contact</a>
      </p>
    </main>
  );
}
