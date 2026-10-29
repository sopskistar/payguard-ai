'use client';
import {
  createDAppKit,
  DAppKitProvider,
  useCurrentAccount,
  useDAppKit,
} from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { useEffect, useRef, useState } from 'react';
import { api } from './ui';
import { useRouter } from 'next/navigation';
const kit = createDAppKit({
  networks: ['mainnet'],
  slushWalletConfig: null, // Installed Wallet Standard wallets only; no implicit external OAuth popup.
  createClient: (network) =>
    new SuiGrpcClient({ network, baseUrl: 'https://fullnode.mainnet.sui.io:443' }),
});
// Signing is personal-message authentication only. No transaction action is called here.
function Connection({
  monitor = false,
  expectedAddress,
}: {
  monitor?: boolean;
  expectedAddress?: string;
}) {
  const router = useRouter();
  const account = useCurrentAccount({ dAppKit: kit });
  const dapp = useDAppKit(kit);
  const previous = useRef<string | null | undefined>(undefined);
  const [challenge, setChallenge] = useState<{
    id: string;
    address: string;
    message: string;
    expiresAt: string;
  }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const address = account?.address ?? null;
    const old = previous.current;
    previous.current = address;
    if (monitor) {
      if ((address && address !== expectedAddress) || (old && address === null))
        window.dispatchEvent(new Event('payguard:wallet-session-changed'));
      return;
    }
    let active = true;
    // Initial disconnected state is not evidence of an account switch; restore may be pending.
    if (address || (old && address === null)) {
      api<{ authenticated: boolean; role?: string; walletAddress?: string }>('auth/session')
        .then(async (session) => {
          if (
            active &&
            session.authenticated &&
            session.role === 'member' &&
            session.walletAddress !== address
          ) {
            await api('auth/logout', {});
            router.replace('/connect?changed=1');
            router.refresh();
          }
        })
        .catch(() => {
          /* A protected API still fails closed if the session expired. */
        });
    }
    return () => {
      active = false;
    };
  }, [account?.address, router, monitor, expectedAddress]);
  if (monitor) return null;
  async function prepare() {
    if (!account) return;
    setBusy(true);
    setError('');
    setChallenge(undefined);
    try {
      setChallenge(await api('auth/wallet/challenge', { address: account.address }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function sign() {
    if (!challenge || !account || account.address !== challenge.address) {
      setChallenge(undefined);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const signed = await dapp.signPersonalMessage({
        message: new TextEncoder().encode(challenge.message),
        account,
      });
      // The server loads its stored message. No client-provided message or user ID is trusted.
      await api('auth/wallet/verify', {
        id: challenge.id,
        address: challenge.address,
        signature: signed.signature,
      });
      router.replace('/app');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setChallenge(undefined);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="wallet-connect-flow">
      <ConnectButton />
      <p>
        {account
          ? 'Wallet connected. You are not signed in until the server verifies your signature.'
          : 'Choose a Sui Wallet Standard wallet. On mobile, open this page inside your compatible wallet’s browser if an installed wallet is not detected.'}
      </p>
      {account && (
        <>
          <code className="wallet-address">{account.address}</code>
          <button className="button outline full" disabled={busy} onClick={prepare}>
            {busy ? 'Working…' : 'Prepare sign-in message'}
          </button>
        </>
      )}
      {challenge && challenge.address === account?.address && (
        <section className="wallet-message">
          <h2>Review what you will sign</h2>
          <pre>{challenge.message}</pre>
          <p>Expires in five minutes. Signing costs no gas and cannot move funds.</p>
          <button className="button primary full" disabled={busy} onClick={sign}>
            {busy ? 'Waiting for wallet…' : 'Sign message & open workspace'}
          </button>
        </section>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
export default function WalletKit({
  monitor = false,
  expectedAddress,
}: {
  monitor?: boolean;
  expectedAddress?: string;
}) {
  return (
    <DAppKitProvider dAppKit={kit}>
      <Connection monitor={monitor} expectedAddress={expectedAddress} />
    </DAppKitProvider>
  );
}
