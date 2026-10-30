import Link from 'next/link';
export default function NotFound() {
  return (
    <main id="main" className="error-page">
      <img src="/brand/icon.png" alt="PayGuard Verify icon" width="90" />
      <h1>This page is outside the watchlist.</h1>
      <p>The page could not be found.</p>
      <Link href="/app" className="button primary">
        Return to PayGuard
      </Link>
    </main>
  );
}
