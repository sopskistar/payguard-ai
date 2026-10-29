'use client';
import dynamic from 'next/dynamic';
function LoadingWallet() {
  return (
    <div className="wallet-connect-flow">
      <p role="status" className="muted">
        Preparing secure wallet connection… If it does not appear, reload the connection and check
        your network. Wallet sign-in requires JavaScript.
      </p>
      <form action="/connect" method="get">
        <button className="button outline" type="submit">
          Reload wallet connection
        </button>
      </form>
    </div>
  );
}
const WalletKit = dynamic(() => import('./wallet-kit'), { ssr: false, loading: LoadingWallet });
const Monitor = dynamic(() => import('./wallet-kit'), { ssr: false });
export function WalletEntry() {
  return <WalletKit />;
}
export function WalletSessionMonitor() {
  return <Monitor monitor />;
}
