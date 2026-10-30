'use client';
import { useEffect, useRef, useState } from 'react';
import {
  createDAppKit,
  DAppKitProvider,
  useDAppKit,
  useWalletConnection,
} from '@mysten/dapp-kit-react';
import { ConnectModal } from '@mysten/dapp-kit-react/ui';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import type { DAppKitConnectModal } from '@mysten/dapp-kit-core/web';

// Loaded only by the review button. This is separate from the sign-in kit.
// No saved accounts, automatic reconnect, authentication action or signing action.
const reviewKit = createDAppKit({
  networks: ['mainnet'],
  autoConnect: false,
  storage: null,
  slushWalletConfig: null,
  enableBurnerWallet: false,
  createClient: (network) =>
    new SuiGrpcClient({ network, baseUrl: 'https://fullnode.mainnet.sui.io:443' }),
});
function ReviewConnection() {
  const modal = useRef<DAppKitConnectModal>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const connection = useWalletConnection({ dAppKit: reviewKit });
  const dapp = useDAppKit(reviewKit);
  const connected = connection.status === 'connected';
  useEffect(() => {
    void modal.current?.show();
  }, []);
  async function disconnect() {
    setBusy(true);
    setError(false);
    try {
      await dapp.disconnectWallet();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="wallet-review-controls">
      {connected ? (
        <>
          <p role="status">
            A wallet connection returned. This does not clear the domain or sign you into PayGuard.
            No authentication or payment will follow.
          </p>
          <button className="button outline full" disabled={busy} onClick={() => void disconnect()}>
            {busy ? 'Disconnecting…' : 'Disconnect review connection'}
          </button>
        </>
      ) : (
        <>
          <button className="button outline full" onClick={() => void modal.current?.show()}>
            Choose wallet for security review
          </button>
          <p>
            Choose the installed Slush extension. If its warning appears, select{' '}
            <strong>Flag for review</strong> inside Slush. Do not approve the connection.
          </p>
        </>
      )}
      <ConnectModal ref={modal} />
      {error && (
        <p role="alert">
          Disconnection did not finish. Use your wallet’s own connection controls, then retry. No
          application session has been created by this review flow.
        </p>
      )}
      <p className="muted">
        Review only. No addresses are displayed or logged by this page. Closing or rejecting the
        wallet request is expected; the absence of a warning is not security clearance.
      </p>
    </div>
  );
}
export default function WalletReviewKit() {
  return (
    <DAppKitProvider dAppKit={reviewKit}>
      <ReviewConnection />
    </DAppKitProvider>
  );
}
