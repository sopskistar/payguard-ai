'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getWallets } from '@wallet-standard/app';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import { toBase64, normalizeSuiAddress } from '@mysten/sui/utils';
import {
  serviceTermsSchema,
  parseServiceChallenge,
  serviceNetworkInfo,
  SERVICE_SESSION_CAP,
  FACILITATOR,
  encodeServicePaymentHeader,
  type ServiceNetwork,
  validateServiceTransaction,
  buildServiceTransaction,
  type ServiceChallenge,
} from '@/lib/service-protocol';
import type { Invoice, Snapshot } from '@/lib/types';
import { api, Badge, Field } from './ui';
import { WALLET_REVIEW_MESSAGE } from '@/lib/wallet-policy';
import { PaymentSetup } from './payment-setup';
import { Brand } from './brand';
import { WalletSessionMonitor } from './wallet-entry';
import { serviceDiagnostic } from '@/lib/service-diagnostics';
import { selectServiceCoins } from '@/lib/service-funding';
import {
  selectServiceAccount,
  frozenServiceTransaction,
  ServiceAccountError,
  type ServiceWalletAccount,
} from '@/lib/service-wallet';
import { ServicePaymentTimeline } from './service-payment-timeline';
import type { RequestDiagnostic } from '@/lib/request-diagnostics';
import type { walletOperationPolicy } from '@/lib/wallet-policy';
import type { ServiceSigningState } from '@/lib/service-recovery';
type SavedIntent = {
  id: string;
  state: string;
  invoiceId: string;
  challenge: ServiceChallenge;
  expiresAt: string;
  digest?: string | null;
  prepared?: { bytes: string; digest: string } | null;
};
type PaymentMetadata = {
  configured: boolean;
  signingAllowed: boolean;
  preparationAllowed?: boolean;
  securityCleared: boolean;
  network: ServiceNetwork;
  dedicatedPayer: string | null;
  intents: SavedIntent[];
  exposure?: { reservedAtomic: string; capAtomic: string };
  capabilities?: ReturnType<typeof walletOperationPolicy>;
  audience?: 'owner' | 'customer';
  publicPilot?: {
    reservedAtomic: string;
    capAtomic: string;
    purchases: number;
    walletCapAtomic: string;
  };
};
type PaymentProgress = {
  signingState?: ServiceSigningState;
  retryAllowed?: boolean;
  prepared?: { bytes: string; digest: string; preparedAt: string } | null;
  executionDigest?: string | null;
  approvalSessionMatches?: boolean;
  walletAttempted?: boolean;
  submitted?: boolean;
  confirming?: boolean;
  diagnostic?: ReturnType<typeof serviceDiagnostic> | null;
  canCancel?: boolean;
  expired?: boolean;
};
type WalletAccount = ServiceWalletAccount;
type WalletFeatures = {
  'standard:connect'?: { connect: () => Promise<{ accounts: WalletAccount[] }> };
  'sui:signTransaction'?: {
    signTransaction: (input: {
      transaction: { toJSON: () => Promise<string> };
      account: WalletAccount;
      chain: ServiceNetwork;
    }) => Promise<{ bytes: string; signature: string }>;
  };
};
async function request(path: string, body: unknown) {
  const payment = !!body && typeof body === 'object' && 'x402Version' in body;
  const r = await fetch('/api/service-payments' + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(payment ? { 'PAYMENT-SIGNATURE': encodeServicePaymentHeader(body) } : {}),
    },
    body: JSON.stringify(payment ? {} : body),
  }).catch(() => {
    throw Object.assign(
      new Error('The connection was interrupted before payment status was returned.'),
      {
        diagnostic: {
          category: 'network',
          stage: 'payment-request',
          code: 'NETWORK_UNCERTAIN',
          message: 'The connection was interrupted before payment status was returned.',
          action:
            'Verify the existing payment before retrying. No automatic signature or settlement retry will be made.',
        } satisfies RequestDiagnostic,
      },
    );
  });
  const result = await r.json().catch(() => ({
    error: 'The server did not return a readable payment response.',
    code: 'INVALID_RESPONSE',
  }));
  if (!r.ok && r.status !== 402)
    throw Object.assign(
      new Error(
        `${result.code ? result.code + ': ' : ''}${result.error || 'Service request unavailable'}`,
      ),
      { code: result.code, diagnostic: result.diagnostic, status: r.status },
    );
  if (r.status === 402) {
    const encoded = r.headers.get('PAYMENT-REQUIRED');
    if (!encoded || encoded.length > 12000)
      throw new Error('Missing or oversized service challenge');
    const challenge = parseServiceChallenge(JSON.parse(atob(encoded)), window.location.origin);
    const { id, expiresAt, ...bodyChallenge } = result;
    const body = parseServiceChallenge(bodyChallenge, window.location.origin);
    if (
      JSON.stringify(body) !== JSON.stringify(challenge) ||
      id !== challenge.accepts[0].extra.quoteId ||
      !Number.isFinite(Date.parse(expiresAt)) ||
      Date.parse(expiresAt) <= Date.now() ||
      Date.parse(expiresAt) > Date.now() + 301000
    )
      throw new Error('Service challenge headers, quote or expiry differ');
  }
  return result;
}

export function ServicePayment() {
  const router = useRouter();
  const quoteOperation = useRef<{ invoiceId: string; key: string } | undefined>(undefined);
  const [data, setData] = useState<Snapshot>(),
    [capabilityState, setCapabilityState] = useState<'loading' | 'ready' | 'error' | 'anonymous'>(
      'loading',
    ),
    [capabilities, setCapabilities] = useState<PaymentMetadata['capabilities']>(),
    [publicPilot, setPublicPilot] = useState<PaymentMetadata['publicPilot']>(),
    [diagnostic, setDiagnostic] = useState<RequestDiagnostic>(),
    [search, setSearch] = useState(''),
    [exposure, setExposure] = useState<{ reservedAtomic: string; capAtomic: string }>(),
    [invoiceId, setInvoice] = useState(''),
    [quote, setQuote] = useState<ServiceChallenge & { id: string; expiresAt: string }>(),
    [configured, setConfigured] = useState(false),
    [signingAllowed, setSigningAllowed] = useState(false),
    [preparationAllowed, setPreparationAllowed] = useState(false),
    [network, setNetwork] = useState<ServiceNetwork>('sui:mainnet'),
    [proposal, setProposal] = useState<Record<string, unknown>>(),
    [walletNames, setWalletNames] = useState<{ id: string; name: string }[]>([]),
    [walletName, setWalletName] = useState(''),
    [dedicatedPayer, setDedicatedPayer] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [statusMessage, setStatusMessage] = useState(''),
    [receipt, setReceipt] = useState<Record<string, unknown>>(),
    [pending, setPending] = useState(false),
    [paymentState, setPaymentState] = useState(''),
    [pendingDigest, setPendingDigest] = useState(''),
    [progress, setProgress] = useState<PaymentProgress>(),
    [storedBytes, setStoredBytes] = useState<{ bytes: string; digest: string }>(),
    [consent, setConsent] = useState(false),
    [now, setNow] = useState(() => Date.now()),
    [prepared, setPrepared] = useState<{
      bytes: string;
      digest: string;
      account: WalletAccount;
      features: WalletFeatures;
      walletName: string;
      quoteId: string;
    }>(),
    [signatureAttempted, setSignatureAttempted] = useState(false),
    [memory, setMemory] = useState(''),
    [saved, setSaved] = useState<SavedIntent[]>([]);
  const quoteExpired = !!quote && Date.parse(quote.expiresAt) <= now;
  const funding = proposal?.fundingCompatibility as
    | { addressAtomic?: string | null; coinAtomic?: string | null; ordinaryCoinFallback?: string }
    | undefined;
  const selectedInvoice = data?.invoices.find((i) => i.id === invoiceId);
  const experiment =
    selectedInvoice?.number.match(/X402-EXPERIMENT-0([23])/i)?.[1] ||
    (selectedInvoice?.number === 'X402-OWNER-20261031-01' ? '1' : undefined);
  const result = receipt?.result as
    | {
        recommendation?: string;
        limitations?: string;
        linkDomains?: string[];
        conflictingRecipientMentions?: string[];
        injectionDirective?: boolean;
      }
    | undefined;
  const evidence = receipt?.evidence as
    { receivedAtomic?: string; checkpoint?: string } | undefined;
  const showError = useCallback((e: unknown) => {
    const failure = e as Error & { diagnostic?: RequestDiagnostic; code?: string; status?: number };
    setError(failure.message || 'Payment status unavailable.');
    setDiagnostic(
      failure.diagnostic ||
        (failure.status === 401 || failure.status === 403
          ? {
              category: 'authentication',
              stage: 'workspace-authentication',
              code: failure.code || 'AUTH_REQUIRED',
              message:
                'Authenticate your wallet or authorized administrator workspace before purchasing.',
              action:
                'Connect your Sui wallet, inspect the free sign-in message, then reload your own saved payment.',
            }
          : undefined),
    );
  }, []);
  function reconciledProgress(id: string, progress: PaymentProgress | undefined) {
    const marker = localStorage.getItem('payguard:service-sign-attempt:' + id);
    if (marker && !progress?.walletAttempted && !progress?.submitted && !progress?.executionDigest)
      return { ...progress, signingState: 'signature-uncertain' as const, retryAllowed: false };
    return progress;
  }
  const openSavedIntent = useCallback(async (i: SavedIntent) => {
    setQuote({ ...i.challenge, id: i.id, expiresAt: i.expiresAt });
    setPaymentState(i.state);
    setPending(i.state === 'settling');
    setStoredBytes(i.prepared || undefined);
    setInvoice(i.invoiceId);
    setReceipt(undefined);
    setConsent(false);
    setMemory('');
    setPrepared(undefined);
    setSignatureAttempted(false);
    setPendingDigest(i.digest || '');
    setProgress(undefined);
    setStatusMessage('');
    const r = await request('/' + i.id + '/resume', {});
    setProgress(reconciledProgress(i.id, r.progress));
    if (r.progress?.prepared) setStoredBytes(r.progress.prepared);
    setSignatureAttempted(
      !!r.progress?.walletAttempted ||
        !!localStorage.getItem('payguard:service-sign-attempt:' + i.id),
    );
    setPending(r.state === 'pending');
    setPaymentState(r.state);
    setSaved((items) =>
      items.map((saved) =>
        saved.id === i.id
          ? { ...saved, state: r.state === 'pending' ? 'settling' : r.state }
          : saved,
      ),
    );
    setStatusMessage(r.message || '');
    if (r.digest) setPendingDigest(r.digest);
    if (r.receipt) setReceipt(r.receipt);
  }, []);
  const applyMetadata = useCallback((r: PaymentMetadata) => {
    setConfigured(r.configured);
    setSigningAllowed(r.signingAllowed);
    setPreparationAllowed(r.preparationAllowed ?? r.signingAllowed);
    setNetwork(r.network);
    setDedicatedPayer(r.dedicatedPayer);
    setSaved(r.intents);
    setExposure(r.exposure);
    setCapabilities(r.capabilities);
    setPublicPilot(r.publicPilot);
    setCapabilityState('ready');
  }, []);
  const loadWorkspace = useCallback(
    async (restore = false) => {
      setCapabilityState('loading');
      setError('');
      setDiagnostic(undefined);
      try {
        const s = await api<Snapshot>('snapshot');
        setData(s);
        const requested = new URLSearchParams(window.location.search).get('invoice');
        const selected =
          s.invoices.find((i) => i.id === requested || i.number === requested) ||
          s.invoices.find((i) => i.isDemo && i.number === 'NS-1048' && i.status !== 'paid') ||
          s.invoices.find((i) => i.status !== 'paid');
        if (restore) setInvoice(selected?.id || '');
        if (s.mode === 'public-demo') {
          setCapabilityState('anonymous');
          return;
        }
        const r = await api<PaymentMetadata>('service-payments');
        if (r.audience && (r.audience === 'customer') !== (s.mode === 'member'))
          throw new ServiceAccountError(
            'CHECKOUT_SESSION_CHANGED',
            'The session changed while loading checkout.',
            'Reload your own wallet workspace before requesting terms.',
          );
        if (
          s.mode === 'member' &&
          (!r.dedicatedPayer ||
            normalizeSuiAddress(s.identity?.walletAddress || '') !==
              normalizeSuiAddress(r.dedicatedPayer))
        )
          throw new ServiceAccountError(
            'CHECKOUT_SESSION_CHANGED',
            'The authenticated wallet does not match checkout.',
            'Sign in to the intended private wallet workspace again.',
          );
        applyMetadata(r);
        if (restore && requested && selected) {
          const existing =
            r.intents.find(
              (i) =>
                i.invoiceId === selected.id && ['quoted', 'approved', 'settling'].includes(i.state),
            ) || r.intents.find((i) => i.invoiceId === selected.id && i.state === 'settled');
          if (existing)
            try {
              await openSavedIntent(existing);
            } catch (e) {
              showError(e);
            }
        }
      } catch (e) {
        setCapabilityState('error');
        showError(e);
      }
    },
    [applyMetadata, openSavedIntent, showError],
  );
  useEffect(() => {
    if (!quote) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [quote]);
  useEffect(() => {
    const timer = setTimeout(() => void loadWorkspace(true), 0);
    return () => clearTimeout(timer);
  }, [loadWorkspace]);
  useEffect(() => {
    if (!preparationAllowed) return;
    const registry = getWallets();
    const update = () =>
      setWalletNames(
        registry
          .get()
          .filter(
            (w) =>
              w.chains.includes(network) &&
              w.features['sui:signTransaction'] &&
              w.features['standard:connect'],
          )
          .map((w) => ({
            id: w.id || w.name,
            name: w.name + (w.id?.endsWith('.web') ? ' · web wallet' : ''),
          })),
      );
    update();
    const offRegister = registry.on('register', update);
    const offUnregister = registry.on('unregister', update);
    return () => {
      offRegister();
      offUnregister();
    };
  }, [preparationAllowed, network]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    setDiagnostic(undefined);
    try {
      await fn();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
      void api<{ exposure?: typeof exposure }>('service-payments')
        .then((r) => setExposure(r.exposure))
        .catch(() => {});
    }
  }
  function trackState(id: string, state: string, digest?: string) {
    setSaved((items) =>
      items.map((i) =>
        i.id === id
          ? { ...i, state: state === 'pending' ? 'settling' : state, ...(digest ? { digest } : {}) }
          : i,
      ),
    );
  }
  async function resumeExistingPayment() {
    if (!quote) return;
    const r = await request('/' + quote.id + '/resume', {});
    setProgress(reconciledProgress(quote.id, r.progress));
    setPending(r.state === 'pending');
    setPaymentState(r.state);
    trackState(quote.id, r.state, r.digest);
    setStatusMessage(
      r.message ||
        (r.receipt
          ? 'Finalized merchant credit verified; analysis report is available.'
          : 'No finalized payment or delivered report is recorded.'),
    );
    if (r.digest) setPendingDigest(r.digest);
    if (r.receipt) setReceipt(r.receipt);
    if (r.progress?.walletAttempted) setSignatureAttempted(true);
  }
  async function allowDeclinedRetry() {
    if (!quote) return;
    setStatusMessage('Checking previous attempt…');
    const r = await request('/' + quote.id + '/resume', {});
    setProgress(r.progress);
    const key = 'payguard:service-sign-attempt:' + quote.id;
    const attempt = JSON.parse(localStorage.getItem(key) || 'null');
    if (
      !r.progress?.retryAllowed ||
      !r.progress.prepared ||
      attempt?.outcome !== 'declined' ||
      attempt.digest !== r.progress.prepared.digest
    )
      throw new Error(
        'The previous result remains uncertain or expired. Do not request another signature.',
      );
    // Only the reported decline is cleared. Reapproval must reuse immutable server bytes.
    localStorage.removeItem(key);
    setStoredBytes(r.progress.prepared);
    setPrepared(undefined);
    setConsent(false);
    setSignatureAttempted(false);
    setPending(false);
    setPaymentState('approved');
    setStatusMessage(
      'Safe to retry the same transaction with fresh approval. Review the terms and prepare again; no signature was requested.',
    );
  }
  async function prepare() {
    if (capabilityState !== 'ready') throw new Error('Reload server capabilities before approval.');
    if (!preparationAllowed) throw new Error(WALLET_REVIEW_MESSAGE);
    if (!quote || !consent) throw new Error('Review and approve every term first');
    if (Date.parse(quote.expiresAt) <= Date.now())
      throw new Error('Quote expired. Review fresh terms before approval.');
    const terms = serviceTermsSchema.parse(quote.accepts[0]);
    parseServiceChallenge(
      { x402Version: quote.x402Version, resource: quote.resource, accepts: quote.accepts },
      window.location.origin,
      network,
    );
    if (terms.network !== network)
      throw new Error('Quote network differs from the selected server mode. Request fresh terms.');
    const chain = serviceNetworkInfo(terms.network);
    const wallets = getWallets()
      .get()
      .filter((w) => w.chains.includes(terms.network) && w.features['sui:signTransaction']);
    if (!wallets.length)
      throw new Error(
        'A compatible wallet must support the approved Sui network and transaction signing. No keys should be entered in PayGuard.',
      );
    const selectedWallet = wallets.find((w) => (w.id || w.name) === walletName);
    if (!selectedWallet) throw new Error('Choose the compatible wallet you intend to use.');
    const features = selectedWallet.features as WalletFeatures;
    let accounts: WalletAccount[];
    try {
      accounts = (await features['standard:connect']!.connect()).accounts;
    } catch (e) {
      const detail = serviceDiagnostic('wallet-connection', e);
      throw Object.assign(new Error(`Wallet connection ${detail.code}: ${detail.message}`), {
        diagnostic: {
          category: 'wallet',
          stage: detail.stage,
          code: detail.code,
          message: detail.message,
          action:
            'Respect a provider warning or refusal. Connection does not authorize a financial signature.',
        } satisfies RequestDiagnostic,
      });
    }
    const account = selectServiceAccount(accounts, {
      network: terms.network,
      expectedPayer: dedicatedPayer,
      audience: data?.mode === 'member' ? 'customer' : 'owner',
      authenticatedWallet: data?.identity?.walletAddress || undefined,
      quotePayer: terms.extra.authenticatedPayer,
    });
    const payer = normalizeSuiAddress(account.address);
    const client = new SuiGrpcClient({
      network: chain.sdk,
      baseUrl: chain.grpc,
    });
    const [{ systemState }, { chainIdentifier }, { balance }] = await Promise.all([
      client.core.getCurrentSystemState(),
      client.core.getChainIdentifier(),
      client.core.getBalance({ owner: account.address, coinType: terms.asset }),
    ]);
    if (chainIdentifier !== chain.genesis) throw new Error('Unexpected Sui chain identifier');
    if (BigInt(balance.balance) < BigInt(terms.amount))
      throw new Error(
        'This wallet needs at least 0.001 SUI in ordinary coins or address balance. No signature or payment was requested.',
      );
    let funding;
    if (BigInt(balance.addressBalance) < BigInt(terms.amount)) {
      const coins = [];
      let cursor: string | null = null;
      for (let page = 0; page < 4; page++) {
        const result = await client.core.listCoins({
          owner: account.address,
          coinType: terms.asset,
          limit: 50,
          cursor,
        });
        coins.push(...result.objects);
        if (!result.hasNextPage) break;
        cursor = result.cursor;
      }
      funding = selectServiceCoins(coins, account.address, terms.amount, balance.addressBalance);
    }
    const tx = buildServiceTransaction(terms, payer, {
      genesis: chainIdentifier,
      epoch: systemState.epoch,
      gasPrice: systemState.referenceGasPrice,
      funding,
      nonce: crypto.getRandomValues(new Uint32Array(1))[0],
    });
    const bytes = storedBytes?.bytes || toBase64(await tx.build({ client }));
    validateServiceTransaction(bytes, terms, payer);
    const approved = await request('/' + quote.id + '/approve', {
      approved: true,
      payer,
      transaction: bytes,
    });
    const digest = await Transaction.from(bytes).getDigest();
    if (approved.prepared && approved.prepared.digest !== digest)
      throw new Error(
        'Saved preparation differs from the displayed transaction. No signature requested.',
      );
    setStoredBytes({ bytes, digest });
    setPrepared({
      bytes,
      digest,
      account,
      features,
      walletName: selectedWallet.id || selectedWallet.name,
      quoteId: quote.id,
    });
    setPaymentState('approved');
    trackState(quote.id, 'approved');
  }
  async function signPrepared() {
    if (capabilityState !== 'ready') throw new Error('Reload server capabilities before signing.');
    if (!signingAllowed) throw new Error(WALLET_REVIEW_MESSAGE);
    if (
      !quote ||
      !prepared ||
      !consent ||
      signatureAttempted ||
      prepared.quoteId !== quote.id ||
      Date.parse(quote.expiresAt) <= Date.now()
    )
      throw new Error('Fresh approved prepared terms are required.');
    const terms = serviceTermsSchema.parse(quote.accepts[0]);
    const current = getWallets()
      .get()
      .find((w) => (w.id || w.name) === prepared.walletName);
    if (
      !current?.accounts.some(
        (a) =>
          normalizeSuiAddress(a.address) === normalizeSuiAddress(prepared.account.address) &&
          a.chains.includes(terms.network) &&
          a.features.includes('sui:signTransaction'),
      )
    )
      throw new Error('Wallet account changed. Reconnect the exact approved payer before signing.');
    validateServiceTransaction(
      prepared.bytes,
      terms,
      normalizeSuiAddress(prepared.account.address),
    );
    const attemptKey = 'payguard:service-sign-attempt:' + quote.id;
    if (localStorage.getItem(attemptKey))
      throw new Error(
        'This exact transaction already had a wallet attempt. Resume existing payment; no repeat signature will be requested.',
      );
    localStorage.setItem(
      attemptKey,
      JSON.stringify({
        digest: prepared.digest,
        outcome: 'uncertain',
        at: new Date().toISOString(),
      }),
    );
    setSignatureAttempted(true);
    setPending(true);
    setPaymentState('awaiting-wallet');
    let signed: { bytes: string; signature: string };
    try {
      // Invoke the official wallet before awaiting any server diagnostic, preserving popup activation.
      const signing = prepared.features['sui:signTransaction']!.signTransaction({
        // The separate fresh click opens Slush before any network work, including Google-login popups.
        transaction: frozenServiceTransaction(prepared.bytes),
        account: prepared.account,
        chain: terms.network,
      });
      void request('/' + quote.id + '/events', {
        phase: 'requested',
        preparedDigest: prepared.digest,
      }).catch(() => {});
      signed = await signing;
    } catch (e) {
      const diagnostic = serviceDiagnostic('wallet-signing', e);
      const declined = diagnostic.code === '4001';
      localStorage.setItem(
        attemptKey,
        JSON.stringify({ digest: prepared.digest, outcome: declined ? 'declined' : 'uncertain' }),
      );
      setPaymentState(declined ? 'signature-declined' : 'signature-failed');
      setPending(false);
      setProgress((previous) => ({
        ...previous,
        diagnostic,
        signingState: declined ? 'signature-declined' : 'signature-failed',
        retryAllowed: false,
      }));
      await request('/' + quote.id + '/events', {
        phase: 'error',
        preparedDigest: prepared.digest,
        code: diagnostic.code,
        message: diagnostic.message,
      }).catch(() => {});
      throw Object.assign(
        new Error(
          `Wallet signing ${diagnostic.code}: ${diagnostic.message} No signed payload was submitted by PayGuard. Resume this record; no automatic retry.`,
        ),
        {
          diagnostic: {
            category: 'wallet',
            stage: 'wallet-signing',
            code: diagnostic.code,
            message: diagnostic.message,
            action:
              'Respect any warning or refusal. Verify this intent; no automatic signature or settlement retry is made.',
          } satisfies RequestDiagnostic,
        },
      );
    }
    if (
      !signed ||
      signed.bytes !== prepared.bytes ||
      typeof signed.signature !== 'string' ||
      !/^[A-Za-z0-9+/=]{4,12000}$/.test(signed.signature)
    ) {
      setPending(false);
      setPaymentState('signature-uncertain');
      setProgress((previous) => ({
        ...previous,
        signingState: 'signature-uncertain',
        retryAllowed: false,
      }));
      throw new Error(
        'Wallet returned a malformed signature or changed approved transaction bytes. Nothing was submitted by PayGuard. The result is uncertain; do not sign again.',
      );
    }
    localStorage.setItem(
      attemptKey,
      JSON.stringify({ digest: prepared.digest, outcome: 'signed' }),
    );
    setPaymentState('signed-unsubmitted');
    setProgress((previous) => ({
      ...previous,
      signingState: 'signed-unsubmitted',
      retryAllowed: false,
    }));
    setPending(false);
    await request('/' + quote.id + '/events', { phase: 'signed', preparedDigest: prepared.digest });
    // A lost response is indeterminate. Resume the same intent instead of signing/paying again.
    setPaymentState('submission-uncertain');
    setPending(true);
    setPendingDigest(prepared.digest);
    const r = await request('/' + quote.id, {
      x402Version: 2,
      resource: quote.resource,
      accepted: terms,
      payload: { transaction: signed.bytes, signature: signed.signature },
    });
    setProgress(r.progress);
    setStatusMessage(
      r.message ||
        (r.receipt ? 'Tatum finalized merchant credit; the analysis report is delivered.' : ''),
    );
    setPending(r.state === 'pending');
    setPaymentState(r.state);
    trackState(quote.id, r.state, r.digest);
    if (r.state === 'failed')
      setError(r.message || 'Tatum confirmed failed execution. No service receipt was created.');
    if (r.receipt) setReceipt(r.receipt);
  }
  return (
    <div className="judge-shell service-payment-page">
      {data?.mode === 'member' && data.identity?.walletAddress && (
        <WalletSessionMonitor expectedAddress={data.identity.walletAddress} />
      )}
      <header className="judge-header">
        <Link href="/" aria-label="PayGuard home">
          <Brand />
        </Link>
        <Link href="/app/review">← Verify Instructions</Link>
        <Link href="/app">Overview</Link>
        <Link href="/courtroom">Courtroom</Link>
        <Badge tone={capabilityState === 'ready' && signingAllowed ? 'mint' : 'amber'}>
          {capabilityState === 'loading'
            ? 'Checking payment capability…'
            : capabilityState === 'error'
              ? 'Payment capability unavailable'
              : capabilityState === 'anonymous'
                ? 'Workspace sign-in required'
                : signingAllowed
                  ? capabilities?.environment === 'production'
                    ? 'Wallet signing available · exact approval required'
                    : data?.mode === 'member'
                      ? 'Local wallet signing available · exact approval required'
                      : 'Local signing available · owner approval required'
                  : 'Transaction signing disabled by server configuration'}
        </Badge>
      </header>
      <main id="main" className="judge-intro">
        <h1>Pay for deeper evidence.</h1>
        {capabilityState === 'ready' && data?.mode !== 'public-demo' && (
          <section className="notice" aria-label="Checkout account">
            <div>
              <strong>
                {data?.mode === 'owner' ? 'Administrator checkout' : 'Your private wallet checkout'}
              </strong>
              <p>
                {data?.mode === 'owner'
                  ? 'This session uses the configured owner payer. A connected personal wallet does not change the administrator session.'
                  : 'Only the wallet authenticated to this private workspace can pay for its invoices.'}
              </p>
              <p>
                <Link className="button outline" href="/app/vendors">
                  Create Supplier
                </Link>{' '}
                <Link className="button outline" href="/app/invoices">
                  Add Invoice
                </Link>{' '}
                <Link className="button outline" href="/app/review">
                  Verify Instructions
                </Link>
              </p>
              <p>
                Expected payer: <code>{dedicatedPayer || 'Not configured'}</code>
              </p>
              {data?.mode === 'member' && (
                <p>
                  Authenticated workspace wallet: <code>{data.identity?.walletAddress}</code>
                </p>
              )}
              <p>
                Connected signing account:{' '}
                <code>
                  {prepared?.account.address || 'Choose and prepare with your wallet to confirm'}
                </code>
              </p>
              <button
                className="button outline"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await api('auth/logout', {});
                    router.push('/connect?next=%2Fservices');
                    router.refresh();
                  })
                }
              >
                {data?.mode === 'owner' ? 'Switch to wallet workspace' : 'Change signed-in wallet'}
              </button>
            </div>
          </section>
        )}
        <p>
          When instruction anomalies need closer inspection, the agent requests a first-party
          consistency report. It compares conflicting recipient mentions and embedded links, then
          preserves the human verification hold.
        </p>
        <div className="notice">
          This buys a PayGuard first-party analysis report, not supplier payment or independent
          identity verification. Mainnet and development Testnet are supported.{' '}
          {saved.some((i) => i.state === 'settled')
            ? 'A saved settled intent exists; inspect its independently verified receipt and delivered report.'
            : 'Inspect the public payment proof for recorded owner-controlled Mainnet results; this session has not loaded a saved receipt.'}
        </div>
        {capabilityState === 'loading' && (
          <p role="status">
            Loading workspace and server capabilities. Wallet/provider status is not yet known.
          </p>
        )}
        {capabilityState === 'ready' && (
          <section className="notice service-preflight" aria-label="Server payment capabilities">
            <h2>Connection, login and purchase permissions</h2>
            <dl className="detail-list">
              <div>
                <dt>Wallet connection</dt>
                <dd>
                  {capabilities?.connectionAvailable === false
                    ? 'Unavailable on this configured origin'
                    : 'Wallet Standard available; provider permission required'}
                </dd>
              </div>
              <div>
                <dt>Wallet authentication</dt>
                <dd>
                  <Link href="/connect">Free personal-message login</Link> · separate from financial
                  approval
                </dd>
              </div>
              <div>
                <dt>Mainnet quotes</dt>
                <dd>{configured ? 'Available' : 'Configuration incomplete or quotes disabled'}</dd>
              </div>
              <div>
                <dt>Unsigned transaction preparation</dt>
                <dd>
                  {preparationAllowed
                    ? 'Available after exact purchase terms acceptance'
                    : capabilities?.financialRestriction ||
                      'Unavailable under the current application policy'}
                </dd>
              </div>
              <div>
                <dt>Transaction signing</dt>
                <dd>
                  {signingAllowed
                    ? 'Available after exact purchase approval; your wallet separately requests a financial signature'
                    : capabilities?.financialRestriction ||
                      'Settlement capability is disabled in server configuration'}
                </dd>
              </div>
              <div>
                <dt>Actual provider decision</dt>
                <dd>
                  {progress?.diagnostic?.stage === 'wallet-signing'
                    ? progress.diagnostic.message
                    : 'No provider rejection is inferred from server capability. Stop if your wallet warns or refuses.'}
                </dd>
              </div>
            </dl>
          </section>
        )}
        {(capabilityState === 'error' || diagnostic) && (
          <button
            className="button outline"
            disabled={busy}
            onClick={() => void loadWorkspace(!quote)}
          >
            Retry workspace and payment status · no signing
          </button>
        )}
        {!data ? (
          <p>Loading your workspace…</p>
        ) : data.mode === 'public-demo' ? (
          <p>
            <Link className="button primary" href="/connect">
              Connect and authenticate your wallet
            </Link>{' '}
            before quoting a service. Public judges can inspect{' '}
            <Link className="inline-link" href="/try">
              the account-free walkthrough
            </Link>
            .
          </p>
        ) : (
          <>
            {data.mode === 'owner' && <PaymentSetup states={saved.map((i) => i.state)} />}
            <section className="panel">
              <h2>First-party invoice consistency analysis</h2>
              <p>
                {data.mode === 'owner'
                  ? 'Owner-controlled Mainnet experiments: payer and merchant are different owner-controlled accounts. '
                  : 'Optional real purchase using only your authenticated wallet. The configured merchant receives the service fee. '}
                A first-party report costs 0.001 SUI. Each purchase requires fresh exact terms
                approval and a separate signature in your wallet. The free Courtroom needs no
                purchase.
              </p>
              {data.mode === 'member' && publicPilot && (
                <p className="notice">
                  Limited sponsored Mainnet pilot: {publicPilot.purchases} purchases total; 0.003
                  SUI per authenticated wallet across sessions, including unsettled reservations.
                  Sponsor gas budget is at most 0.002 SUI per attempt. Ordinary SUI coins and
                  address balances are supported; no separate deposit is needed.{' '}
                  <Link href="/courtroom">Evaluate the free Memory Courtroom</Link>.
                </p>
              )}
              {exposure && (
                <p role="status">
                  {data.mode === 'member'
                    ? 'Your wallet’s persistent pilot exposure'
                    : 'Current authenticated-session exposure'}
                  : {Number(exposure.reservedAtomic) / 1e9} / 0.003 SUI, including settled purchases
                  and all unsettled reservations.
                </p>
              )}
              <button
                className="button outline"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const r = await api<PaymentMetadata>('service-payments');
                    if (quote && (r.network !== network || r.dedicatedPayer !== dedicatedPayer))
                      throw new Error(
                        'Payment party or network configuration changed. Cancel the unsigned quote and inspect fresh terms.',
                      );
                    applyMetadata(r);
                  })
                }
              >
                Refresh payment controls · no signing
              </button>
              <button
                className="button outline"
                disabled={busy}
                onClick={() =>
                  void run(async () =>
                    setProposal(await api<Record<string, unknown>>('service-payments/preflight')),
                  )
                }
              >
                Check Mainnet proposal · no signing
              </button>
              {proposal && (
                <section className="notice service-preflight">
                  <h3>Read-only purchase preflight</h3>
                  <p>
                    This proposal does not authorize spending. PayGuard supplies a first-party
                    consistency report, not independent supplier identity verification. The three
                    published experiments used owner-controlled accounts; this proposal uses the
                    payer shown below.
                  </p>
                  <dl className="detail-list">
                    {[
                      ['Network', proposal.network],
                      ['Exact service fee', `${proposal.amount} · ${proposal.amountAtomic} MIST`],
                      ['Coin type', proposal.asset],
                      ['Authenticated payer', proposal.payer || 'Not configured'],
                      ['Merchant recipient', proposal.recipient || 'Not configured'],
                      [
                        'Usable address-balance SUI',
                        funding?.addressAtomic != null
                          ? `${Number(funding.addressAtomic) / 1e9} SUI`
                          : 'Not returned',
                      ],
                      [
                        'Ordinary coin-object SUI',
                        funding?.coinAtomic != null
                          ? `${Number(funding.coinAtomic) / 1e9} SUI · owned-coin fallback available`
                          : 'Not returned',
                      ],
                      ['Provider', proposal.provider],
                      ['Service origin', proposal.resourceOrigin],
                      ['Facilitator', proposal.facilitator],
                      [
                        'Payer network fee cap',
                        `${proposal.maxPayerGasAtomic} MIST · facilitator sponsors gas`,
                      ],
                      ['Sponsor budget cap', `${proposal.maxSponsorGasAtomic} MIST`],
                      ['Reason for purchase', proposal.purpose],
                      ['Expected result', proposal.expectedResult],
                    ].map(([label, value]) => (
                      <div key={String(label)}>
                        <dt>{String(label)}</dt>
                        <dd>{String(value ?? 'Unavailable')}</dd>
                      </div>
                    ))}
                  </dl>
                  <p role="status">
                    {proposal.configurationReady
                      ? proposal.sufficientlyFunded
                        ? 'Parties and usable funds are verified. Exact purchase approval and provider permission are still required before signing.'
                        : 'Parties are configured, but combined SUI funds are insufficient. Refresh after funding, or use the free Courtroom.'
                      : `Proposal is incomplete. Configure public address names: ${Array.isArray(proposal.missing) ? proposal.missing.join(', ') : 'review server configuration'}. All parties must differ.`}
                  </p>
                  <details>
                    <summary>Read-only chain proof and risk details</summary>
                    <pre className="service-result">{JSON.stringify(proposal, null, 2)}</pre>
                  </details>
                </section>
              )}
              {['Unfinished payments', 'Paid report history'].map((group) => (
                <section key={group} aria-label={group}>
                  <h3>{group}</h3>
                  {saved.filter((i) =>
                    group === 'Paid report history'
                      ? i.state === 'settled'
                      : ['quoted', 'approved', 'settling', 'failed'].includes(i.state),
                  ).length === 0 && (
                    <p>
                      {group === 'Paid report history'
                        ? 'No paid reports in this workspace yet.'
                        : 'No saved unfinished payments.'}
                    </p>
                  )}
                  {saved
                    .filter((i) =>
                      group === 'Paid report history'
                        ? i.state === 'settled'
                        : ['quoted', 'approved', 'settling', 'failed'].includes(i.state),
                    )
                    .map((i) => (
                      <button
                        className="button outline"
                        key={i.id}
                        disabled={busy}
                        onClick={() => void run(() => openSavedIntent(i))}
                      >
                        Resume saved {i.state} intent ·{' '}
                        {data.invoices.find((v) => v.id === i.invoiceId)?.number ||
                          i.invoiceId.slice(0, 8)}{' '}
                        · {i.id.slice(0, 8)}
                      </button>
                    ))}
                </section>
              ))}
              <p>
                Deterministic supplemental analysis, not an independent identity check or a phone
                call. No spending key is stored by PayGuard. Checkout uses address-balance SUI
                first, then an exact split from your own SUI coins if needed. Coin change stays with
                you. Every purchase requires your separate wallet signature.
              </p>
              {!configured && (
                <div role="status" className="notice">
                  Quote preparation is disabled or incomplete. Review Payment Setup for the exact
                  configuration status. ENABLE_AGENT_PAYMENTS=false keeps quotes off while read-only
                  balance checks remain available. Settlement is separately disabled.
                </div>
              )}
              {data.invoices.length === 0 && (
                <p className="notice">
                  Your private workspace has no invoices yet.{' '}
                  <Link href="/app/vendors">Establish a supplier reference</Link>, then{' '}
                  <Link href="/app/invoices">
                    add a clearly labeled synthetic or user-owned invoice
                  </Link>
                  . Paid analysis is optional; the <Link href="/courtroom">Courtroom is free</Link>.
                </p>
              )}
              <Field label="Search invoices by supplier or identifier">
                <input
                  value={search}
                  disabled={!!quote}
                  placeholder="e.g. X402-EXPERIMENT-02"
                  onChange={(e) => setSearch(e.target.value)}
                />
              </Field>
              <Field label="Invoice requiring additional review">
                <select
                  value={invoiceId}
                  disabled={!!quote}
                  onChange={(e) => setInvoice(e.target.value)}
                >
                  <option value="">
                    {data.invoices.some((i) => i.status !== 'paid')
                      ? 'Select an unpaid invoice'
                      : 'No unpaid invoices · add an invoice above'}
                  </option>
                  {data.invoices
                    .filter(
                      (i: Invoice) =>
                        i.status !== 'paid' &&
                        (i.id === invoiceId ||
                          `${i.vendor} ${i.number} ${i.id}`
                            .toLowerCase()
                            .includes(search.trim().toLowerCase())),
                    )
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.vendor} · {i.number} · {i.status} ·{' '}
                        {i.isDemo ? 'sample' : 'stored record'} · {i.id.slice(0, 8)}
                      </option>
                    ))}
                </select>
              </Field>
              {selectedInvoice && (
                <dl className="detail-list" aria-label="Selected invoice details">
                  <div>
                    <dt>Selected invoice</dt>
                    <dd>
                      {selectedInvoice.vendor} · {selectedInvoice.number}
                    </dd>
                  </div>
                  {experiment && (
                    <div>
                      <dt>Current experiment</dt>
                      <dd>{experiment} of 3 · synthetic invoice scenario</dd>
                    </div>
                  )}
                  <div>
                    <dt>Expected report</dt>
                    <dd>
                      Contradictory recipient references, linked domains and attempts to bypass
                      safety rules. Supplier verification holds remain mandatory.
                    </dd>
                  </div>
                  <div>
                    <dt>Review before purchase</dt>
                    <dd>
                      <Link
                        className="inline-link"
                        href={`/app/review?invoice=${selectedInvoice.id}`}
                      >
                        Open invoice and compare Memory OFF / ON
                      </Link>
                    </dd>
                  </div>
                  <div>
                    <dt>Record ID</dt>
                    <dd>
                      <code>{selectedInvoice.id}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Context</dt>
                    <dd>
                      {selectedInvoice.isDemo
                        ? 'Synthetic sample saved in this workspace'
                        : 'Saved workspace record; not independently certified'}{' '}
                      · {selectedInvoice.status} · issued {selectedInvoice.issued} ·{' '}
                      {selectedInvoice.amount} {selectedInvoice.currency}
                    </dd>
                  </div>
                </dl>
              )}
              <button
                className="button primary"
                disabled={
                  capabilityState !== 'ready' ||
                  !configured ||
                  !selectedInvoice ||
                  selectedInvoice.status === 'paid' ||
                  busy ||
                  !!quote ||
                  saved.some((i) => i.state === 'settling')
                }
                onClick={() =>
                  void run(async () => {
                    if (quoteOperation.current?.invoiceId !== invoiceId)
                      quoteOperation.current = { invoiceId, key: crypto.randomUUID() };
                    const r = await request('', {
                      invoiceId,
                      operationKey: quoteOperation.current.key,
                    });
                    parseServiceChallenge(
                      { x402Version: r.x402Version, resource: r.resource, accepts: r.accepts },
                      window.location.origin,
                      network,
                    );
                    setQuote(r);
                    setStatusMessage('');
                    setStoredBytes(undefined);
                    setProgress(undefined);
                    setSaved((items) => [
                      {
                        id: r.id,
                        state: 'quoted',
                        invoiceId,
                        challenge: {
                          x402Version: r.x402Version,
                          resource: r.resource,
                          accepts: r.accepts,
                        },
                        expiresAt: r.expiresAt,
                      },
                      ...items.filter((i) => i.id !== r.id),
                    ]);
                    setNow(Date.now());
                    setPrepared(undefined);
                    setSignatureAttempted(false);
                    setPendingDigest('');
                    setPaymentState('quoted');
                  })
                }
              >
                Request payment quote
              </button>
              {quote && (
                <>
                  <h3>
                    {receipt ? 'Purchase confirmed · saved receipt' : 'Payment required · x402 v2'}
                  </h3>
                  <ServicePaymentTimeline
                    quoteId={quote.id}
                    preparedDigest={prepared?.digest || storedBytes?.digest}
                    phase={paymentState}
                    progress={progress}
                    receipt={receipt}
                  />
                  <button
                    className="button outline"
                    disabled={busy}
                    onClick={() => void run(resumeExistingPayment)}
                  >
                    {receipt
                      ? 'Verify payment and view analysis report'
                      : 'Resume existing payment'}
                  </button>
                  {statusMessage && <p role="status">{statusMessage}</p>}
                  {progress?.retryAllowed && signatureAttempted && (
                    <button
                      className="button outline"
                      disabled={busy || quoteExpired}
                      onClick={() => void run(allowDeclinedRetry)}
                    >
                      Review declined attempt · allow same-transaction retry
                    </button>
                  )}
                  <p>Reason for this quote: {quote.resource.description}</p>
                  {quoteExpired && !receipt && (
                    <p role="status">
                      This quote has expired. No new signing is available. Resume an existing
                      submitted digest; request fresh terms only for an unpaid review.
                    </p>
                  )}
                  {!pending && !receipt && (
                    <button
                      className="button outline small"
                      disabled={busy || signatureAttempted || progress?.canCancel === false}
                      onClick={() =>
                        void run(async () => {
                          if (paymentState !== 'failed')
                            await request('/' + quote.id + '/cancel', {});
                          if (paymentState !== 'failed') trackState(quote.id, 'cancelled');
                          setQuote(undefined);
                          quoteOperation.current = undefined;
                          setStatusMessage('');
                          setConsent(false);
                        })
                      }
                    >
                      {paymentState === 'failed'
                        ? 'Close failed record'
                        : quoteExpired && progress?.canCancel
                          ? 'Cancel expired unsigned quote'
                          : 'Cancel unpaid quote'}
                    </button>
                  )}
                  <dl className="detail-list">
                    <div>
                      <dt>Provider and purpose</dt>
                      <dd>
                        PayGuard first-party invoice consistency analysis. This does not verify
                        supplier identity.
                      </dd>
                    </div>
                    <div>
                      <dt>Service URL</dt>
                      <dd>
                        <code>{quote.resource.url}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>Payer</dt>
                      <dd>
                        <code>
                          {dedicatedPayer ||
                            'Configure the dedicated payer before Mainnet approval.'}
                        </code>
                      </dd>
                    </div>
                    <div>
                      <dt>Facilitator</dt>
                      <dd>{FACILITATOR}</dd>
                    </div>
                    <div>
                      <dt>Network</dt>
                      <dd>
                        {serviceNetworkInfo(quote.accepts[0].network).name} ·{' '}
                        {quote.accepts[0].network}
                      </dd>
                    </div>
                    <div>
                      <dt>Asset</dt>
                      <dd>
                        <code>{quote.accepts[0].asset}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>Exact service fee / cap</dt>
                      <dd>
                        0.001 {quote.accepts[0].network === 'sui:testnet' ? 'Testnet ' : ''}SUI
                        (1,000,000 MIST; 9 decimals)
                      </dd>
                    </div>
                    <div>
                      <dt>Total session cap</dt>
                      <dd>
                        0.003 SUI ({SERVICE_SESSION_CAP} MIST); pending payments reserve this cap.
                      </dd>
                    </div>
                    <div>
                      <dt>Recipient</dt>
                      <dd>
                        <code>{quote.accepts[0].payTo}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>Gas</dt>
                      <dd>
                        Facilitator-sponsored, maximum budget 2,000,000 MIST. Payer fee cap: 0 MIST.
                        Sponsor: <code>{quote.accepts[0].extra.gasOwner}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>Quote expires</dt>
                      <dd>
                        {new Date(quote.expiresAt).toLocaleString()}. This limits PayGuard
                        submission, not the signed transaction’s chain lifetime.
                      </dd>
                    </div>
                    <div>
                      <dt>Signed-transaction lifetime</dt>
                      <dd>
                        Current epoch through the next epoch. Sui does not currently support
                        timestamp expiry. Once signed bytes are disclosed, they can be relayed
                        within that window; cancellation is not revocation.
                      </dd>
                    </div>
                  </dl>
                  <label className="checkbox">
                    <input
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      type="checkbox"
                    />
                    I explicitly approve only these exact network, recipient, amount and sponsor
                    terms for this first-party report. The wallet will separately request my
                    signature.
                  </label>
                  {preparationAllowed && (
                    <Field label="Signing wallet">
                      <select
                        disabled={busy || !!prepared}
                        value={walletName}
                        onChange={(e) => setWalletName(e.target.value)}
                      >
                        <option value="">Choose a compatible wallet</option>
                        {walletNames.map((wallet) => (
                          <option key={wallet.id} value={wallet.id}>
                            {wallet.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  <button
                    className="button primary"
                    disabled={
                      capabilityState !== 'ready' ||
                      !preparationAllowed ||
                      busy ||
                      !consent ||
                      pending ||
                      !!receipt ||
                      paymentState === 'failed' ||
                      quoteExpired ||
                      !!prepared ||
                      signatureAttempted
                    }
                    onClick={() => void run(prepare)}
                  >
                    {busy ? 'Checking…' : 'Review 0.001 SUI purchase · prepare'}
                  </button>
                  {preparationAllowed && (
                    <button
                      className="button outline"
                      disabled={busy || !!prepared || signatureAttempted}
                      onClick={() =>
                        void run(async () => {
                          const { registerSlushWallet } = await import('@mysten/slush-wallet');
                          const registered = registerSlushWallet('PayGuard Verify');
                          if (!registered)
                            throw new Error(
                              'Official Slush web wallet unavailable. No signing requested.',
                            );
                          setWalletName(registered.wallet.id || registered.wallet.name);
                        })
                      }
                    >
                      Use existing Slush web wallet
                    </button>
                  )}
                  {prepared && (
                    <>
                      <p>
                        Approving the next wallet signature submits these exact bytes to Tentacle
                        for one verification and settlement attempt. If the response is uncertain,
                        only resume the existing digest; do not sign or pay again.
                      </p>
                      <p className="service-prepared-digest">
                        Prepared digest (not settlement proof): <code>{prepared.digest}</code>.
                        Retain this digest if a response is uncertain; do not prepare a replacement
                        payment.
                      </p>
                      <details>
                        <summary>Inspect exact prepared transaction before signing</summary>
                        <pre className="service-result">
                          {JSON.stringify(Transaction.from(prepared.bytes).getData(), null, 2)}
                        </pre>
                      </details>
                      <button
                        className="button primary"
                        disabled={
                          capabilityState !== 'ready' ||
                          !signingAllowed ||
                          busy ||
                          !consent ||
                          quoteExpired ||
                          signatureAttempted ||
                          !!receipt
                        }
                        onClick={() => void run(signPrepared)}
                      >
                        Sign and submit in wallet
                      </button>
                    </>
                  )}
                  {pending && (
                    <>
                      {pendingDigest && (
                        <p className="service-prepared-digest">
                          Original digest to reconcile: <code>{pendingDigest}</code>. This is not
                          confirmation of success.
                        </p>
                      )}
                      <p role="status">
                        {paymentState === 'awaiting-wallet'
                          ? 'Wallet signing has not completed or returned a verified response. No new signature will be requested automatically. Check the existing intent before doing anything else.'
                          : 'Submission or independent Tatum confirmation is pending. Resume the same digest; do not pay again.'}
                      </p>
                    </>
                  )}
                  {receipt && (
                    <>
                      <Badge tone="mint">Tatum-confirmed service receipt</Badge>
                      <button
                        className="button outline"
                        onClick={() => {
                          setQuote(undefined);
                          quoteOperation.current = undefined;
                          setStatusMessage('');
                          setReceipt(undefined);
                          setConsent(false);
                          setPaymentState('');
                          setMemory('');
                        }}
                      >
                        Review another invoice
                      </button>
                      <dl className="detail-list">
                        <div>
                          <dt>Confirmed Mainnet transaction</dt>
                          <dd>
                            <a
                              className="inline-link"
                              href={`https://suivision.xyz/txblock/${String(receipt.digest)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {String(receipt.digest)}
                            </a>
                          </dd>
                        </div>
                        <div>
                          <dt>Merchant credit verified by Tatum</dt>
                          <dd>
                            {evidence?.receivedAtomic === '1000000'
                              ? '0.001 SUI · 1,000,000 MIST'
                              : 'Inspect saved evidence'}{' '}
                            · checkpoint {evidence?.checkpoint || 'see evidence'}
                          </dd>
                        </div>
                        <div>
                          <dt>Delivered recommendation</dt>
                          <dd>{result?.recommendation || 'See saved report'}</dd>
                        </div>
                        <div>
                          <dt>Linked domains found</dt>
                          <dd>{result?.linkDomains?.join(', ') || 'None'}</dd>
                        </div>
                        <div>
                          <dt>Conflicting recipient references</dt>
                          <dd>{result?.conflictingRecipientMentions?.join(', ') || 'None'}</dd>
                        </div>
                        <div>
                          <dt>Safety bypass text</dt>
                          <dd>
                            {result?.injectionDirective
                              ? 'Detected in submitted text'
                              : 'Not detected'}
                          </dd>
                        </div>
                      </dl>
                      <p>
                        {result?.limitations} Reopening this receipt does not request a signature or
                        charge again.
                      </p>
                      <details>
                        <summary>Saved receipt and full report</summary>
                        <pre className="service-result">{JSON.stringify(receipt, null, 2)}</pre>
                      </details>
                      <p>
                        Supplier approval still requires the independent human verification
                        workflow.
                      </p>
                      <p>
                        Optional minimized learning for this vendor: “Always require independent
                        verification for new or changed payout addresses.” Only the rule and a
                        scoped vendor reference are saved; raw invoice text, wallet signatures and
                        payment payloads are excluded.
                      </p>
                      <button
                        className="button outline"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const r = await request('/' + quote.id + '/remember', {
                              consent: true,
                            });
                            setMemory(
                              r.status === 'confirmed'
                                ? 'Walrus learning confirmed: ' + r.blobId
                                : 'Learning ' +
                                    r.status +
                                    '; resume the existing job in Memory Lab.',
                            );
                          })
                        }
                      >
                        Consent to a minimized Walrus verification rule
                      </button>
                      {memory && <p role="status">{memory}</p>}
                    </>
                  )}
                </>
              )}
            </section>
          </>
        )}
        {error && (
          <div role="alert" className="error-banner">
            <p>{error}</p>
            {diagnostic && (
              <dl className="detail-list">
                <div>
                  <dt>Problem</dt>
                  <dd>
                    {diagnostic.category} · {diagnostic.code}
                  </dd>
                </div>
                <div>
                  <dt>Stage</dt>
                  <dd>{diagnostic.stage}</dd>
                </div>
                <div>
                  <dt>Next step</dt>
                  <dd>{diagnostic.action}</dd>
                </div>
              </dl>
            )}
            {diagnostic?.category === 'authentication' && (
              <Link
                className="button outline"
                href={data?.mode === 'owner' ? '/app?signin=1' : '/connect'}
              >
                {data?.mode === 'owner'
                  ? 'Owner administrator sign in'
                  : 'Authenticate your Sui wallet'}
              </Link>
            )}
            <button className="button outline small" onClick={() => setError('')}>
              Dismiss
            </button>
          </div>
        )}
        <Link
          className="inline-link"
          href="https://github.com/sopskistar/payguard-ai/blob/main/docs/AGENT_PAYMENTS.md"
        >
          Protocol, controls and settlement status ↗
        </Link>
      </main>
    </div>
  );
}
