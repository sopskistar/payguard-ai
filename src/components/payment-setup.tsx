'use client';
import { useEffect, useState } from 'react';
import type { ServiceSetup } from '@/lib/service-payments';
import {
  FACILITATOR,
  SERVICE_AMOUNT,
  SERVICE_SESSION_CAP,
  serviceNetworkInfo,
} from '@/lib/service-protocol';
import { formatSui, fundingState, failedPaymentCheck } from '@/lib/service-setup';
import type { ServiceWalletBalance } from '@/lib/integrations/service-tatum';
import { api } from './ui';

export function PaymentSetup({ states }: { states: string[] }) {
  const [setup, setSetup] = useState<ServiceSetup>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [comparedPayer, setComparedPayer] = useState<string | null>(null);
  const [qr, setQr] = useState('');
  const [lastBalances, setLastBalances] = useState<
    Partial<Record<'payer' | 'recipient', ServiceWalletBalance>>
  >({});
  useEffect(() => {
    let active = true;
    api<ServiceSetup>('service-payments/setup')
      .then((r) => {
        if (active) setSetup(r);
      })
      .catch(() => {
        if (active)
          setMessage('Payment configuration could not be loaded. Sign in again or retry.');
      });
    return () => {
      active = false;
    };
  }, []);
  const payer = setup?.payer;
  const compared = !!payer && comparedPayer === payer;
  useEffect(() => {
    let active = true;
    if (payer && compared) {
      void import('qrcode')
        .then((module) =>
          module.toDataURL(payer, { width: 240, margin: 4, errorCorrectionLevel: 'M' }),
        )
        .then((url) => {
          if (active) setQr(url);
        })
        .catch(() => {
          if (active)
            setMessage('QR unavailable. Use the full address and compare it in your wallet.');
        });
    }
    return () => {
      active = false;
    };
  }, [payer, compared]);
  async function refresh() {
    setBusy(true);
    setMessage('');
    try {
      const next = await api<ServiceSetup>('service-payments/setup-check');
      setSetup(next);
      setLastBalances((previous) => {
        const balances = next.check.preflight?.chain.balances;
        return {
          payer:
            balances?.payer || (previous.payer?.owner === next.payer ? previous.payer : undefined),
          recipient:
            balances?.recipient ||
            (previous.recipient?.owner === next.recipient ? previous.recipient : undefined),
        };
      });
    } catch {
      const diagnostic = failedPaymentCheck('request', 'Payment Setup request', new Error());
      setSetup(
        (previous) =>
          previous && {
            ...previous,
            check: {
              state: 'failed',
              preflight: null,
              diagnostics: [diagnostic],
              checkedAt: diagnostic.checkedAt,
              message:
                'The latest request failed. Current balances are unknown; last successful results are labeled below.',
            },
          },
      );
      setMessage(
        'Read-only check failed. No payment was submitted. Retry after checking your session.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage('Public address copied. Compare every character before using it.');
    } catch {
      setMessage('Copy unavailable. Select and copy the full displayed address.');
    }
  }
  const preflight = setup?.check.preflight;
  const balances = preflight?.chain.balances;
  const funded = !!preflight?.sufficientlyFunded;
  const pending = states.some((s) => s === 'settling');
  const failed = states.some((s) => s === 'failed');
  const settled = states.filter((s) => s === 'settled').length;
  const funding = balances?.payer
    ? fundingState(balances.payer.addressAtomic, balances.payer.coinAtomic)
    : 'Balance not checked';
  const status = !setup?.partiesValid
    ? 'Not configured'
    : setup.check.state === 'failed' || setup.check.state === 'partial'
      ? 'Failed or uncertain: provider check unavailable'
      : pending
        ? 'Pending settlement: reconcile the existing digest; do not pay again'
        : failed
          ? 'Failed transaction recorded: inspect its saved evidence'
          : settled > 0
            ? `${settled} confirmed settled service ${settled === 1 ? 'purchase' : 'purchases'} recorded; inspect the saved receipt`
            : preflight && !funded
              ? 'Configured but insufficient usable funds'
              : funded
                ? preflight?.readyForExactApproval
                  ? 'Ready for owner authorization of a fresh exact quote'
                  : 'Configured and sufficiently funded; security clearance still required'
                : 'Ready for non-spending preflight';
  return (
    <section
      id="payment-setup"
      className="panel payment-setup"
      aria-labelledby="payment-setup-title"
    >
      <h2 id="payment-setup-title">Payment Setup · administrator only</h2>
      <p>
        Use your two existing accounts. Wallet A pays for analysis; Wallet B receives the service
        fee. Public-address configuration does not establish ownership.
      </p>
      <p role="status" aria-live="polite">
        <strong>{status}</strong>
      </p>
      {busy && (
        <p role="status">
          Checking Wallet A and Wallet B on Sui Mainnet, plus provider compatibility. No signing or
          transaction.
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!setup ? (
        <button className="button outline" disabled={busy} onClick={() => void refresh()}>
          Load payment setup
        </button>
      ) : (
        <>
          <dl className="detail-list">
            {[
              ['Network', `${serviceNetworkInfo(setup.network).name} · ${setup.network}`],
              [
                'Service / provider',
                'Invoice consistency analysis · PayGuard first-party deterministic analysis',
              ],
              [
                'Expected result',
                'Conflicting recipient references, embedded link domains and instruction-bypass findings. Human verification holds remain.',
              ],
              ['Facilitator', FACILITATOR],
              ['Price', `0.001 SUI (${SERVICE_AMOUNT} MIST)`],
              [
                'Session exposure cap',
                `0.003 SUI (${SERVICE_SESSION_CAP} MIST), including pending and disclosed signatures`,
              ],
              ['Gas', 'Facilitator sponsored: 2,000,000 MIST budget; payer gas cap 0 MIST'],
              [
                'Quote mode',
                setup.quoteEnabled
                  ? 'Enabled; fresh provider and usable-funds checks required for Mainnet quotes'
                  : 'Quote preparation disabled. Read-only balance checks remain available with ENABLE_AGENT_PAYMENTS=false.',
              ],
              [
                'Settlement',
                setup.settlementEnabled
                  ? 'Switch enabled; every payment still requires exact owner approval'
                  : 'Disabled',
              ],
              [
                'Security clearance',
                setup.securityCleared
                  ? 'Controlled local environment only; no production Slush clearance implied'
                  : 'Blocked: unresolved Slush review. No production signing.',
              ],
              ['Account control', setup.controlVerification],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="payment-accounts">
            {(['payer', 'recipient'] as const).map((role) => {
              const address = setup[role];
              const current = balances?.[role];
              const previous =
                lastBalances[role]?.owner === address ? lastBalances[role] : undefined;
              const balance = current || previous;
              const stale = !current && !!previous;
              const diagnostic = setup.check.diagnostics?.find(
                (d) => d.stage === 'balance.' + role,
              );
              return (
                <section
                  key={role}
                  className="notice payment-account"
                  data-wallet={role}
                  aria-busy={busy}
                >
                  <h3>{role === 'payer' ? 'Wallet A · payer' : 'Wallet B · merchant'}</h3>
                  <div className="payment-address">
                    <code
                      aria-label={
                        role === 'payer'
                          ? 'Wallet A full public address'
                          : 'Wallet B full public address'
                      }
                    >
                      {address || 'Not configured'}
                    </code>
                    {address && (
                      <button className="button outline small" onClick={() => void copy(address)}>
                        Copy {role === 'payer' ? 'payer' : 'merchant'} address
                      </button>
                    )}
                  </div>
                  {stale && (
                    <p role="status">
                      Current balance unknown: latest check failed. The amounts below are the last
                      successful snapshot, not current funding readiness.
                    </p>
                  )}
                  {balance ? (
                    <dl className="detail-list">
                      <div>
                        <dt>Total native SUI</dt>
                        <dd>
                          {formatSui(balance.totalAtomic)} SUI ({balance.totalAtomic} MIST)
                        </dd>
                      </div>
                      <div>
                        <dt>Coin objects</dt>
                        <dd>
                          {formatSui(balance.coinAtomic)} SUI ({balance.coinAtomic} MIST)
                        </dd>
                      </div>
                      <div>
                        <dt>Address balance</dt>
                        <dd>
                          {formatSui(balance.addressAtomic)} SUI ({balance.addressAtomic} MIST)
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p>
                      Balance unknown.{' '}
                      {busy ? 'Checking this wallet…' : 'Run or retry the read-only check.'}
                    </p>
                  )}
                  <p className="wallet-funding-status" role="status">
                    {busy
                      ? 'Refreshing both wallets…'
                      : current
                        ? role === 'payer'
                          ? fundingState(current.addressAtomic, current.coinAtomic)
                          : 'Merchant receiving account checked. No merchant funding is required for this sponsored service payment.'
                        : 'Funding readiness unknown.'}
                  </p>
                  <p>
                    Last successful balance check:{' '}
                    {balance?.checkedAt ? (
                      <time dateTime={balance.checkedAt}>
                        {new Date(balance.checkedAt).toLocaleString()}
                      </time>
                    ) : (
                      'No successful check yet'
                    )}
                  </p>
                  {current?.derivation && (
                    <small>{current.derivation}. Amounts are in native SUI, 9 decimals.</small>
                  )}
                  {!busy && diagnostic?.status === 'failed' && (
                    <p role="alert">
                      {diagnostic.message} {diagnostic.action}
                    </p>
                  )}
                </section>
              );
            })}
          </div>
          {!setup.partiesValid && (
            <p>
              Both addresses must be canonical nonzero Sui addresses: 0x followed by 64 lowercase
              hexadecimal characters. Payer, merchant and facilitator sponsor must all differ.
              Addresses do not encode a network; the check verifies Mainnet separately.
            </p>
          )}
          <button className="button outline" disabled={busy} onClick={() => void refresh()}>
            {busy
              ? 'Checking both wallets…'
              : 'Refresh balances for both wallets and compatibility · no signing'}
          </button>
          {(setup.check.state === 'failed' || setup.check.state === 'partial') && (
            <button className="button outline" disabled={busy} onClick={() => void refresh()}>
              Retry checks for both wallets
            </button>
          )}
          <p role="status">
            {funding}.{' '}
            {preflight?.chain.genesis
              ? `Tatum native Sui gRPC checked ${preflight.checkedAt}. Checkpoint ${preflight.chain.checkpoint}. This is a balance snapshot, not a settlement.`
              : setup.check.state === 'failed' || setup.check.state === 'partial'
                ? setup.check.message
                : 'No live compatibility or funding check has run on this screen.'}
          </p>
          {!!setup.check.diagnostics?.length && (
            <section className="payment-diagnostics" aria-label="Read-only check diagnostics">
              <h3>Read-only check results</h3>
              <ol>
                {setup.check.diagnostics.map((d) => (
                  <li key={d.stage}>
                    <strong>
                      {d.label}: {d.status}
                    </strong>
                    <p>
                      {d.message} {d.action}
                    </p>
                    <small>
                      {d.stage} · {d.classification} · {d.code} ·{' '}
                      <time dateTime={d.checkedAt}>{d.checkedAt}</time>
                    </small>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {preflight && (
            <p>
              Facilitator sponsorship{' '}
              {preflight.configurationReady
                ? 'and distinct parties verified'
                : 'advertised; parties incomplete or conflict'}
              . Sponsor: <code>{preflight.sponsor}</code>. Advertised support does not prove funded
              execution.
            </p>
          )}
          <details>
            <summary>Configuration and Vercel instructions</summary>
            <ol>
              {setup.partiesValid ? (
                <li>
                  Your existing Wallet A and Wallet B addresses are configured. Keep them unchanged;
                  compare the complete addresses above with your wallets.
                </li>
              ) : (
                <li>
                  In Vercel, open the existing <strong>payguard-ai</strong> project → Settings →
                  Environment Variables. Select <strong>Production</strong>.
                </li>
              )}
              {!setup.partiesValid && (
                <li>
                  Set <code>SERVICE_PAYMENT_PAYER</code> to your existing Wallet A public address
                  and <code>SERVICE_PAYMENT_RECIPIENT</code> to your existing Wallet B public
                  address. Compare each with the address shown in that wallet. Keep all existing
                  credentials.
                </li>
              )}
              <li>
                Keep <code>ENABLE_AGENT_PAYMENTS=false</code> and{' '}
                <code>SERVICE_PAYMENT_SETTLEMENT_ENABLED=false</code> during debugging. Checking
                balances requires no environment changes or signing.
              </li>
              <li>
                Return here and refresh. After configuration, funding and read-only checks pass,
                quote preparation uses <code>ENABLE_AGENT_PAYMENTS=mainnet</code> (not{' '}
                <code>true</code>). Save and redeploy again. Keep settlement <code>false</code>.
              </li>
              <li>
                Slush clearance and a controlled physical-wallet retest must precede production
                signing. Review and approve each exact transaction separately.
              </li>
            </ol>
            <table>
              <caption>Current server configuration · credential values hidden</caption>
              <thead>
                <tr>
                  <th>Variable</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {setup.variables.map((v) => (
                  <tr key={v.name}>
                    <td>
                      <code>{v.name}</code>
                    </td>
                    <td>{v.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <details>
            <summary>Funding your existing payer account</summary>
            <p>
              Select <strong>Sui Mainnet</strong> in Wallet A. Use native <strong>SUI</strong>, not
              a bridged token or Testnet faucet. The merchant is a different receiving account; fund
              the payer for this purchase.
            </p>
            <p>
              Minimum usable service balance:{' '}
              <strong>0.001 SUI (1,000,000 MIST) in address balance</strong>. Proposed
              first-experiment target: that minimum only. Current address-balance shortfall:{' '}
              {balances?.payer
                ? `${formatSui((BigInt(SERVICE_AMOUNT) > BigInt(balances.payer.addressAtomic) ? BigInt(SERVICE_AMOUNT) - BigInt(balances.payer.addressAtomic) : 0n).toString())} SUI`
                : 'unknown until checked'}
              . The 0.003 SUI session cap is a limit, not a funding request or permission for three
              payments.
            </p>
            <p>
              A wallet transfer may arrive as coin objects. If so, a separate owner-controlled
              conversion to address balance is required. Conversion or withdrawal fees depend on
              that separately reviewed transaction; the zero gas cap applies to the service payment
              only. PayGuard does not fund or convert assets.
            </p>
            {payer && setup.partiesValid && (
              <>
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={compared}
                    onChange={(e) => {
                      setComparedPayer(e.target.checked ? payer : null);
                      setQr('');
                    }}
                  />
                  I compared the complete payer address with my existing Wallet A and selected Sui
                  Mainnet.
                </label>
                {compared && (
                  <div className="payment-qr">
                    <p>Owner-compared funding destination · Sui Mainnet native SUI</p>
                    <code>{payer}</code>
                    {qr && (
                      <img
                        src={qr}
                        width={240}
                        height={240}
                        alt="QR containing the displayed payer public address only"
                      />
                    )}
                    <p>
                      QR encodes only the address. Check the network and amount in your wallet. This
                      checkbox is not a signature or proof of account control.
                    </p>
                  </div>
                )}
              </>
            )}
            <p>
              No recovery phrase or private key belongs in this app, chat, GitHub, Neon or Vercel.
            </p>
          </details>
          <details>
            <summary>Payment states and evidence</summary>
            <ul>
              <li>Not configured: a required public address is missing, invalid or reused.</li>
              <li>
                Configured but unfunded: checked usable address balance is below 1,000,000 MIST.
              </li>
              <li>
                Configured and sufficiently funded: Tatum reports enough usable address balance.
              </li>
              <li>
                Ready for non-spending preflight: configuration is present; run the check above.
              </li>
              <li>
                Ready for owner authorization: live checks pass, security is cleared, and a fresh
                exact quote can be reviewed. Configuration alone is no approval.
              </li>
              <li>
                Pending settlement: preserve the original digest and reconcile; never pay again to
                retry.
              </li>
              <li>
                Confirmed settled: requires finalized exact merchant credit independently checked
                through Tatum, a Neon receipt and delivered analysis. Saved settled records:{' '}
                {settled} (current account, latest intents).
              </li>
              <li>
                Failed or uncertain: failed execution or unavailable evidence. No success assumed;
                inspect the original intent.
              </li>
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
