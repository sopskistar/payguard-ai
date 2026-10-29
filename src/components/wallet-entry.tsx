'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { api } from './ui';
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
export function WalletSessionMonitor({ expectedAddress }: { expectedAddress: string }) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    void api<{ allowed: boolean }>('auth/wallet/status')
      .then((status) => setAllowed(status.allowed))
      .catch(() => setAllowed(false));
  }, []);
  // Do not load/auto-connect the SDK on a hosted origin under security review.
  return allowed ? <Monitor monitor expectedAddress={expectedAddress} /> : null;
}
