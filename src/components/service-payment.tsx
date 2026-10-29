'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getWallets } from '@wallet-standard/app';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import { toBase64 } from '@mysten/sui/utils';
import {
  serviceTermsSchema,
  parseServiceChallenge,
  serviceNetworkInfo,
  SERVICE_SESSION_CAP,
  FACILITATOR,
  encodeServicePaymentHeader,
  type ServiceNetwork,
  validateServiceTransaction,
  type ServiceChallenge,
} from '@/lib/service-protocol';
import type { Invoice, Snapshot } from '@/lib/types';
import { api, Badge, Field } from './ui';
import { WALLET_REVIEW_MESSAGE } from '@/lib/wallet-policy';
type WalletAccount = { address: string; chains: readonly string[] };
type WalletFeatures = {
  'standard:connect'?: { connect: () => Promise<{ accounts: WalletAccount[] }> };
  'sui:signTransaction'?: {
    signTransaction: (input: {
      transaction: Transaction;
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
  });
  const result = await r.json();
  if (!r.ok && r.status !== 402) throw new Error(result.error || 'Service request unavailable');
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
  const [data, setData] = useState<Snapshot>(),
    [invoiceId, setInvoice] = useState(''),
    [quote, setQuote] = useState<ServiceChallenge & { id: string; expiresAt: string }>(),
    [configured, setConfigured] = useState(false),
    [signingAllowed, setSigningAllowed] = useState(false),
    [network, setNetwork] = useState<ServiceNetwork>('sui:mainnet'),
    [proposal, setProposal] = useState<Record<string, unknown>>(),
    [walletNames, setWalletNames] = useState<string[]>([]),
    [walletName, setWalletName] = useState(''),
    [dedicatedPayer, setDedicatedPayer] = useState<string | null>(null),
    [securityCleared, setSecurityCleared] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [receipt, setReceipt] = useState<Record<string, unknown>>(),
    [pending, setPending] = useState(false),
    [paymentState, setPaymentState] = useState(''),
    [consent, setConsent] = useState(false),
    [memory, setMemory] = useState(''),
    [saved, setSaved] = useState<
      {
        id: string;
        state: string;
        invoiceId: string;
        challenge: ServiceChallenge;
        expiresAt: string;
      }[]
    >([]);
  useEffect(() => {
    api<Snapshot>('snapshot')
      .then((s) => {
        setData(s);
        setInvoice(
          s.invoices.find((i) => i.isDemo && i.number === 'NS-1048')?.id || s.invoices[0]?.id || '',
        );
        if (s.mode === 'owner')
          api<{
            configured: boolean;
            signingAllowed: boolean;
            securityCleared: boolean;
            network: ServiceNetwork;
            dedicatedPayer: string | null;
            intents: typeof saved;
          }>('service-payments')
            .then((r) => {
              setConfigured(r.configured);
              setSigningAllowed(r.signingAllowed);
              setNetwork(r.network);
              setDedicatedPayer(r.dedicatedPayer);
              setSecurityCleared(r.securityCleared);
              setSaved(r.intents);
            })
            .catch((e) => setError(e.message));
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!signingAllowed) return;
    const registry = getWallets();
    const update = () =>
      setWalletNames(
        registry
          .get()
          .filter((w) => w.chains.includes(network) && w.features['sui:signTransaction'])
          .map((w) => w.name),
      );
    update();
    const offRegister = registry.on('register', update);
    const offUnregister = registry.on('unregister', update);
    return () => {
      offRegister();
      offUnregister();
    };
  }, [signingAllowed, network]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function sign() {
    if (!signingAllowed) throw new Error(WALLET_REVIEW_MESSAGE);
    if (!quote || !consent) throw new Error('Review and approve every term first');
    const terms = serviceTermsSchema.parse(quote.accepts[0]);
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
    const selectedWallet = wallets.find((w) => w.name === walletName);
    if (!selectedWallet) throw new Error('Choose the compatible wallet you intend to use.');
    const features = selectedWallet.features as WalletFeatures;
    const accounts = (await features['standard:connect']!.connect()).accounts;
    const account = accounts.find(
      (a) =>
        a.chains.includes(terms.network) &&
        (terms.network !== 'sui:mainnet' || a.address === dedicatedPayer),
    );
    if (!account)
      throw new Error('Select the dedicated approved payer on the specified Sui network.');
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
    if (BigInt(balance.addressBalance) < BigInt(terms.amount))
      throw new Error(
        'The dedicated wallet needs sufficient native SUI address balance for this sponsored protocol. Coin-object holdings alone do not qualify. No deposit or payment was initiated.',
      );
    const tx = new Transaction();
    tx.setSender(account.address);
    const redeemed = tx.moveCall({
      target: '0x2::balance::redeem_funds',
      typeArguments: [terms.asset],
      arguments: [tx.withdrawal({ type: terms.asset, amount: BigInt(terms.amount) })],
    });
    tx.moveCall({
      target: '0x2::balance::send_funds',
      typeArguments: [terms.asset],
      arguments: [redeemed, tx.pure.address(terms.payTo)],
    });
    tx.pure.string(terms.extra.quoteId);
    const epoch = Number(systemState.epoch);
    tx.setExpiration({
      ValidDuring: {
        chain: chainIdentifier,
        minEpoch: epoch,
        maxEpoch: epoch + 1,
        minTimestamp: null,
        maxTimestamp: null,
        nonce: crypto.getRandomValues(new Uint32Array(1))[0],
      },
    });
    tx.setGasOwner(terms.extra.gasOwner);
    tx.setGasBudget(terms.extra.gasBudget);
    tx.setGasPrice(systemState.referenceGasPrice);
    tx.setGasPayment([]);
    const bytes = toBase64(await tx.build({ client }));
    validateServiceTransaction(bytes, terms, account.address);
    await request('/' + quote.id + '/approve', { approved: true, payer: account.address });
    const signed = await features['sui:signTransaction']!.signTransaction({
      transaction: Transaction.from(bytes),
      account,
      chain: terms.network,
    });
    if (signed.bytes !== bytes)
      throw new Error(
        'Wallet changed approved transaction bytes; nothing was submitted by PayGuard',
      );
    // A lost response is indeterminate. Resume the same intent instead of signing/paying again.
    setPending(true);
    const r = await request('/' + quote.id, {
      x402Version: 2,
      resource: quote.resource,
      accepted: terms,
      payload: { transaction: signed.bytes, signature: signed.signature },
    });
    setPending(r.state === 'pending');
    setPaymentState(r.state);
    if (r.state === 'failed')
      setError(r.message || 'Tatum confirmed failed execution. No service receipt was created.');
    if (r.receipt) setReceipt(r.receipt);
  }
  return (
    <div className="judge-shell">
      <header className="judge-header">
        <Link href="/app/review">← Verify Instructions</Link>
        <Badge tone="amber">Mainnet implementation · spending gated</Badge>
      </header>
      <main id="main" className="judge-intro">
        <h1>Pay for deeper evidence.</h1>
        <p>
          When instruction anomalies need closer inspection, the agent requests a first-party
          consistency report. It compares conflicting recipient mentions and embedded links, then
          preserves the human verification hold.
        </p>
        <div className="notice">
          This buys a PayGuard first-party analysis report, not supplier payment or independent
          identity verification. Mainnet and development Testnet are supported. No genuine service
          settlement has been demonstrated yet.
        </div>
        {!signingAllowed && (
          <div role="status" className="notice">
            {!securityCleared
              ? WALLET_REVIEW_MESSAGE
              : 'Settlement remains disabled pending exact owner authorization.'}{' '}
            Service terms may be prepared, but wallet signing and new settlement are blocked.
          </div>
        )}
        {!data ? (
          <p>Loading owner workspace…</p>
        ) : data.mode !== 'owner' ? (
          <p>
            <Link className="button primary" href="/app">
              Sign in through the owner workspace
            </Link>{' '}
            before quoting a service. Public judges can inspect{' '}
            <Link className="inline-link" href="/try">
              the account-free walkthrough
            </Link>
            .
          </p>
        ) : (
          <section className="panel">
            <h2>First-party invoice consistency analysis</h2>
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
              <section className="notice">
                <h3>Read-only purchase preflight</h3>
                <p>
                  This is a proposal, not permission to spend. Buyer and seller may both be
                  controlled by the project; this is not an independent third-party identity check.
                </p>
                <dl className="detail-list">
                  {[
                    ['Network', proposal.network],
                    ['Exact service fee', `${proposal.amount} · ${proposal.amountAtomic} MIST`],
                    ['Coin type', proposal.asset],
                    ['Dedicated payer', proposal.payer || 'Not configured'],
                    ['Merchant recipient', proposal.recipient || 'Not configured'],
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
                  {proposal.readyForExactApproval
                    ? 'Parties are configured. Exact owner approval and wallet-security clearance are still required before signing.'
                    : `Proposal is incomplete. Configure public address names: ${Array.isArray(proposal.missing) ? proposal.missing.join(', ') : 'review server configuration'}. All parties must differ.`}
                </p>
                <details>
                  <summary>Read-only chain proof and risk details</summary>
                  <pre className="service-result">{JSON.stringify(proposal, null, 2)}</pre>
                </details>
              </section>
            )}
            {saved
              .filter((i) => ['settling', 'settled', 'failed'].includes(i.state))
              .map((i) => (
                <button
                  className="button outline"
                  key={i.id}
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      setQuote({ ...i.challenge, id: i.id, expiresAt: i.expiresAt });
                      setInvoice(i.invoiceId);
                      const r = await request('/' + i.id + '/resume', {});
                      setPending(r.state === 'pending');
                      setPaymentState(r.state);
                      if (r.state === 'failed')
                        setError(
                          'Tatum confirmed failed execution. No service receipt was created.',
                        );
                      if (r.receipt) setReceipt(r.receipt);
                    })
                  }
                >
                  Resume saved {i.state} intent · {i.id.slice(0, 8)}
                </button>
              ))}
            <p>
              Deterministic supplemental analysis, not an independent identity check or a phone
              call. No spending key is stored by PayGuard. The sponsored native-SUI protocol
              requires address-balance funds; ordinary coin-object holdings alone are insufficient.
              PayGuard never moves funds into address balance automatically.
            </p>
            {!configured && (
              <div role="status" className="notice">
                Not configured. Owner environment names: ENABLE_AGENT_PAYMENTS,
                SERVICE_PAYMENT_RECIPIENT, TATUM_API_KEY. Mainnet additionally requires the
                dedicated public SERVICE_PAYMENT_PAYER. Settlement remains separately disabled by
                default.
              </div>
            )}
            <Field label="Invoice requiring additional review">
              <select
                value={invoiceId}
                disabled={!!quote}
                onChange={(e) => setInvoice(e.target.value)}
              >
                {data.invoices
                  .filter((i: Invoice) => i.status !== 'paid')
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.vendor} · {i.number}
                    </option>
                  ))}
              </select>
            </Field>
            <button
              className="button primary"
              disabled={!configured || busy || !!quote}
              onClick={() =>
                void run(async () => {
                  const r = await request('', { invoiceId, operationKey: crypto.randomUUID() });
                  parseServiceChallenge(
                    { x402Version: r.x402Version, resource: r.resource, accepts: r.accepts },
                    window.location.origin,
                    network,
                  );
                  setQuote(r);
                  setPaymentState('quoted');
                })
              }
            >
              Request exact service terms
            </button>
            {quote && (
              <>
                <h3>Payment required · x402 v2</h3>
                {!pending && !receipt && (
                  <button
                    className="button outline small"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        if (paymentState !== 'failed')
                          await request('/' + quote.id + '/cancel', {});
                        setQuote(undefined);
                        setConsent(false);
                      })
                    }
                  >
                    {paymentState === 'failed' ? 'Close failed record' : 'Cancel unpaid quote'}
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
                        {dedicatedPayer || 'Configure the dedicated payer before Mainnet approval.'}
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
                    <dd>{new Date(quote.expiresAt).toLocaleString()}</dd>
                  </div>
                </dl>
                <label className="checkbox">
                  <input
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    type="checkbox"
                  />
                  I explicitly approve only these exact network, recipient, amount and sponsor terms
                  for this first-party report. The wallet will separately request my signature.
                </label>
                {signingAllowed && (
                  <Field label="Signing wallet">
                    <select value={walletName} onChange={(e) => setWalletName(e.target.value)}>
                      <option value="">Choose a compatible wallet</option>
                      {walletNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <button
                  className="button primary"
                  disabled={
                    !signingAllowed ||
                    busy ||
                    !consent ||
                    pending ||
                    !!receipt ||
                    paymentState === 'failed'
                  }
                  onClick={() => void run(sign)}
                >
                  {busy ? 'Checking…' : 'Approve exact terms & sign in wallet'}
                </button>
                {pending && (
                  <>
                    <p role="status">
                      Pending independent Tatum confirmation. Resume the same digest; do not pay
                      again.
                    </p>
                    <button
                      className="button outline"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const r = await request('/' + quote.id + '/resume', {});
                          setPending(r.state === 'pending');
                          setPaymentState(r.state);
                          if (r.state === 'failed')
                            setError(r.message || 'Tatum confirmed failed execution.');
                          if (r.receipt) setReceipt(r.receipt);
                        })
                      }
                    >
                      Resume settlement check
                    </button>
                  </>
                )}
                {receipt && (
                  <>
                    <Badge tone="mint">Tatum-confirmed service receipt</Badge>
                    <pre className="service-result">{JSON.stringify(receipt, null, 2)}</pre>
                    <p>
                      Supplier approval still requires the independent human verification workflow.
                    </p>
                    <button
                      className="button outline"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const r = await request('/' + quote.id + '/remember', { consent: true });
                          setMemory(
                            r.status === 'confirmed'
                              ? 'Walrus learning confirmed: ' + r.blobId
                              : 'Learning ' + r.status + '; resume the existing job in Memory Lab.',
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
        )}
        {error && (
          <p role="alert" className="error-banner">
            {error}{' '}
            <button className="button outline small" onClick={() => setError('')}>
              Dismiss
            </button>
          </p>
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
