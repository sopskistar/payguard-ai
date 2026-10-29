'use client';
import dynamic from 'next/dynamic';
const WalletKit = dynamic(() => import('./wallet-kit'), {
  ssr: false,
  loading: () => <p className="muted">Preparing secure wallet connection…</p>,
});
export function WalletEntry() {
  return <WalletKit />;
}
export function WalletSessionMonitor() {
  return <WalletKit monitor />;
}
