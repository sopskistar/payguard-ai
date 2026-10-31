'use client';
import {
  createDAppKit,
  DAppKitProvider,
  useCurrentAccount,
  useDAppKit,
  useWallets,
  useCurrentWallet,
} from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { useEffect, useRef, useState } from 'react';
import { api } from './ui';
import { useRouter } from 'next/navigation';
import { walletProviderAllowed } from '@/lib/wallet-policy';
import { getWalletUniqueIdentifier } from '@mysten/dapp-kit-core';
const kit = createDAppKit({
  networks: ['mainnet'],
  autoConnect: false,
  slushWalletConfig: null, // Installed Wallet Standard wallets only; no implicit external OAuth popup.
  createClient: (network) =>
    new SuiGrpcClient({ network, baseUrl: 'https://fullnode.mainnet.sui.io:443' }),
});
// Signing is personal-message authentication only. No transaction action is called here.
function Connection({
  monitor = false,
  expectedAddress,
  slushBlocked = false,
}: {
  monitor?: boolean;
  expectedAddress?: string;
  slushBlocked?: boolean;
}) {
  const router = useRouter();
  const account = useCurrentAccount({ dAppKit: kit });
  const currentWallet = useCurrentWallet({ dAppKit: kit });
  const dapp = useDAppKit(kit);
  const wallets = useWallets({ dAppKit: kit });
  const [choosing, setChoosing] = useState(false);
  const available = wallets.filter(
    (w) =>
      walletProviderAllowed(w.name, slushBlocked) &&
      w.chains.includes('sui:mainnet') &&
      w.features.includes('sui:signPersonalMessage'),
  );
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
    if (!currentWallet || !walletProviderAllowed(currentWallet.name, slushBlocked)) {
      setError(
        'Slush login is unavailable on this origin pending its security review. Do not override a warning.',
      );
      return;
    }
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
    if (!currentWallet || !walletProviderAllowed(currentWallet.name, slushBlocked)) {
      setError('This wallet provider remains restricted on this origin. No signature requested.');
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
      <button
        className="button primary full"
        disabled={busy}
        onClick={() => setChoosing(!choosing)}
      >
        Connect Wallet
      </button>
      {choosing && (
        <div className="wallet-connect-flow">
          {available.map((wallet) => (
            <button
              className="button outline full"
              key={getWalletUniqueIdentifier(wallet)}
              disabled={busy}
              onClick={async () => {
                if (!walletProviderAllowed(wallet.name, slushBlocked)) return;
                setBusy(true);
                setError('');
                setChallenge(undefined);
                try {
                  await dapp.connectWallet({ wallet });
                  setChoosing(false);
                } catch {
                  setError(
                    'The wallet did not permit this connection. Respect any provider warning; no authentication or payment was completed.',
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {wallet.name}
              {getWalletUniqueIdentifier(wallet).endsWith('.web') ? ' · web wallet' : ''}
            </button>
          ))}
          {!available.length && (
            <p>
              No compatible installed Sui wallet detected. On mobile, use your wallet’s own browser,
              or deliberately open the official Slush web account below. Provider availability is
              checked by the wallet; stop if it displays a warning.
            </p>
          )}
        </div>
      )}
      {!slushBlocked && (
        <button
          className="button outline full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              const { registerSlushWallet } = await import('@mysten/slush-wallet');
              if (!registerSlushWallet('PayGuard Verify')) throw new Error();
              setChoosing(true);
            } catch {
              setError('Official Slush web wallet unavailable. No signature was requested.');
            } finally {
              setBusy(false);
            }
          }}
        >
          Use existing Slush web account
        </button>
      )}
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
          <button
            className="button outline full"
            disabled={busy}
            onClick={async () => {
              setChallenge(undefined);
              setBusy(true);
              setError('');
              try {
                await api('auth/logout', {});
                await dapp.disconnectWallet();
                setChoosing(true);
                router.refresh();
              } catch {
                setError('Could not complete sign-out. Retry before switching accounts.');
              } finally {
                setBusy(false);
              }
            }}
          >
            Sign out and choose another wallet
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
  slushBlocked,
}: {
  monitor?: boolean;
  expectedAddress?: string;
  slushBlocked?: boolean;
}) {
  return (
    <DAppKitProvider dAppKit={kit}>
      <Connection monitor={monitor} expectedAddress={expectedAddress} slushBlocked={slushBlocked} />
    </DAppKitProvider>
  );
}
