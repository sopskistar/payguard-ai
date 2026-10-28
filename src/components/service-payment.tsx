'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getWallets } from '@wallet-standard/app';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';
import { toBase64 } from '@mysten/sui/utils';
import {
  serviceTermsSchema,
  TESTNET_GENESIS,
  validateServiceTransaction,
  type ServiceChallenge,
} from '@/lib/service-protocol';
import type { Invoice, Snapshot } from '@/lib/types';
import { api, Badge, Field } from './ui';
type WalletAccount = { address: string; chains: readonly string[] };
type WalletFeatures = {
  'standard:connect'?: { connect: () => Promise<{ accounts: WalletAccount[] }> };
  'sui:signTransaction'?: {
    signTransaction: (input: {
      transaction: Transaction;
      account: WalletAccount;
      chain: 'sui:testnet';
    }) => Promise<{ bytes: string; signature: string }>;
  };
};
export function ServicePayment() {
  const [data, setData] = useState<Snapshot>(),
    [invoiceId, setInvoice] = useState(''),
    [quote, setQuote] = useState<ServiceChallenge & { id: string; expiresAt: string }>(),
    [configured, setConfigured] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [receipt, setReceipt] = useState<Record<string, unknown>>(),
    [pending, setPending] = useState(false),
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
          api<{ configured: boolean; intents: typeof saved }>('service-payments')
            .then((r) => {
              setConfigured(r.configured);
              setSaved(r.intents);
            })
            .catch((e) => setError(e.message));
      })
      .catch((e) => setError(e.message));
  }, []);
  async function request(path: string, body: unknown) {
    const r = await fetch('/api/service-payments' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await r.json();
    if (!r.ok && r.status !== 402) throw new Error(result.error || 'Service request unavailable');
    return result;
  }
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
    if (!quote || !consent) throw new Error('Review and approve every term first');
    const terms = serviceTermsSchema.parse(quote.accepts[0]);
    const wallets = getWallets()
      .get()
      .filter((w) => w.chains.includes('sui:testnet') && w.features['sui:signTransaction']);
    if (!wallets.length)
      throw new Error(
        'Install a Sui wallet supporting Testnet and signTransaction. No keys should be entered in PayGuard.',
      );
    const features = wallets[0].features as WalletFeatures;
    const accounts = (await features['standard:connect']!.connect()).accounts;
    const account = accounts.find((a) => a.chains.includes('sui:testnet'));
    if (!account) throw new Error('Select a Sui Testnet account in the wallet');
    await request('/' + quote.id + '/approve', { approved: true, payer: account.address });
    const client = new SuiGrpcClient({
      network: 'testnet',
      baseUrl: 'https://fullnode.testnet.sui.io:443',
    });
    const [{ systemState }, { chainIdentifier }] = await Promise.all([
      client.core.getCurrentSystemState(),
      client.core.getChainIdentifier(),
    ]);
    if (chainIdentifier !== TESTNET_GENESIS) throw new Error('Unexpected Testnet chain identifier');
    const tx = new Transaction();
    tx.setSender(account.address);
    tx.moveCall({
      target: '0x2::balance::send_funds',
      typeArguments: [terms.asset],
      arguments: [
        tx.balance({ type: terms.asset, balance: BigInt(terms.amount), useGasCoin: false }),
        tx.pure.address(terms.payTo),
      ],
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
    const signed = await features['sui:signTransaction']!.signTransaction({
      transaction: Transaction.from(bytes),
      account,
      chain: 'sui:testnet',
    });
    if (signed.bytes !== bytes)
      throw new Error(
        'Wallet changed approved transaction bytes; nothing was submitted by PayGuard',
      );
    const r = await request('/' + quote.id, {
      x402Version: 2,
      resource: quote.resource,
      accepted: terms,
      payload: { transaction: signed.bytes, signature: signed.signature },
    });
    setPending(r.state === 'pending');
    if (r.receipt) setReceipt(r.receipt);
  }
  return (
    <div className="judge-shell">
      <header className="judge-header">
        <Link href="/app/review">← Verify Instructions</Link>
        <Badge tone="amber">Controlled Testnet feature</Badge>
      </header>
      <main id="main" className="judge-intro">
        <h1>Pay for deeper evidence.</h1>
        <p>
          When instruction anomalies need closer inspection, the agent requests a first-party
          consistency report. It compares conflicting recipient mentions and embedded links, then
          preserves the human verification hold.
        </p>
        <div className="notice">
          Supplier payments remain unavailable. This feature supports a capped Testnet service fee
          only. Mainnet settlement is disabled and no bonus settlement has yet been proven.
        </div>
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
            {saved
              .filter((i) => i.state === 'settling' || i.state === 'settled')
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
                      if (r.receipt) setReceipt(r.receipt);
                    })
                  }
                >
                  Resume saved {i.state} intent · {i.id.slice(0, 8)}
                </button>
              ))}
            <p>
              Deterministic supplemental analysis, not an independent identity check or a phone
              call. No spending key is stored by PayGuard.
            </p>
            {!configured && (
              <div role="status" className="notice">
                Not configured. Owner environment names: ENABLE_AGENT_PAYMENTS,
                SERVICE_PAYMENT_RECIPIENT, TATUM_API_KEY. Use a separate Testnet wallet and
                merchant; no Mainnet approval is enabled.
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
                  setQuote(r);
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
                    onClick={() => {
                      setQuote(undefined);
                      setConsent(false);
                    }}
                  >
                    Close unpaid quote
                  </button>
                )}
                <dl className="detail-list">
                  <div>
                    <dt>Network</dt>
                    <dd>Sui Testnet · sui:testnet</dd>
                  </div>
                  <div>
                    <dt>Asset</dt>
                    <dd>
                      <code>{quote.accepts[0].asset}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Exact service fee / cap</dt>
                    <dd>0.001 Testnet SUI (1,000,000 atomic units)</dd>
                  </div>
                  <div>
                    <dt>Recipient</dt>
                    <dd>
                      <code>{quote.accepts[0].payTo}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Gas</dt>
                    <dd>Facilitator-sponsored, maximum budget 2,000,000 MIST</dd>
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
                  I explicitly approve only these Testnet terms for this first-party report. The
                  wallet will separately request my signature.
                </label>
                <button
                  className="button primary"
                  disabled={busy || !consent || pending || !!receipt}
                  onClick={() => void run(sign)}
                >
                  {busy ? 'Checking…' : 'Approve terms & sign in Testnet wallet'}
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
