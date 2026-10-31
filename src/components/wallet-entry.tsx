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
        <input type="hidden" name="mode" value="signin" />
        <button className="button outline" type="submit">
          Reload wallet connection
        </button>
      </form>
    </div>
  );
}
const WalletKit = dynamic(() => import('./wallet-kit'), { ssr: false, loading: LoadingWallet });
const Monitor = dynamic(() => import('./wallet-kit'), { ssr: false });
export function WalletEntry({ slushBlocked = false }: { slushBlocked?: boolean }) {
  return <WalletKit slushBlocked={slushBlocked} />;
}
export function WalletSessionMonitor({ expectedAddress }: { expectedAddress: string }) {
  const [allowed, setAllowed] = useState(false);
  const [slushBlocked, setSlushBlocked] = useState(true);
  useEffect(() => {
    void api<{ allowed: boolean; slushBlocked: boolean }>('auth/wallet/status')
      .then((status) => {
        setAllowed(status.allowed);
        setSlushBlocked(status.slushBlocked);
      })
      .catch(() => setAllowed(false));
  }, []);
  // The kit never automatically connects or opens a provider popup.
  return allowed ? (
    <Monitor monitor expectedAddress={expectedAddress} slushBlocked={slushBlocked} />
  ) : null;
}
