import { getWallets } from '@wallet-standard/app';
import { fromBase64 } from '@mysten/sui/utils';
import { Transaction } from '@mysten/sui/transactions';
import {
  AMOUNT,
  CHAIN,
  GAS_BUDGET,
  GENESIS,
  assertExactBytes,
  formatSui,
  type Plan,
} from './transaction';

type Preview = {
  mode: string;
  signingEnabled: boolean;
  executionEnabled: boolean;
  checkedAt: string;
  reviewExpiresAt: string;
  genesis: string;
  chain: string;
  amountMist: string;
  gasBudgetMist: string;
  plan: Plan;
  before: Record<'total' | 'coins' | 'address', string>;
  expected: Record<'total' | 'coins' | 'address' | 'minimumCoinsAfterGasCap', string>;
  simulation: {
    success: boolean;
    checksEnabled: boolean;
    gasPaymentMocked: boolean;
    estimatedNetGasMist: string;
    gas: Record<string, string>;
  };
  unsignedBytes: string;
  unsignedDigest: string;
  sha256: string;
  decoded: unknown;
};
const element = (id: string) => {
  const node = document.getElementById(id);
  if (!node) throw new Error('Missing review element.');
  return node;
};
const set = (id: string, text: string) => {
  element(id).textContent = text;
};
const button = (id: string) => element(id) as HTMLButtonElement;
function definition(id: string, values: Record<string, string>) {
  const node = element(id);
  node.replaceChildren();
  for (const [label, value] of Object.entries(values)) {
    const dt = document.createElement('dt'),
      dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value;
    node.append(dt, dd);
  }
}
async function init() {
  const response = await fetch('/preview.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Unsigned preview unavailable.');
  const p: Preview = await response.json();
  if (
    p.mode !== 'review-only' ||
    p.signingEnabled !== false ||
    p.executionEnabled !== false ||
    p.chain !== CHAIN ||
    p.genesis !== GENESIS ||
    p.amountMist !== AMOUNT.toString() ||
    p.gasBudgetMist !== GAS_BUDGET.toString() ||
    !p.simulation.success ||
    !p.simulation.checksEnabled ||
    p.simulation.gasPaymentMocked
  )
    throw new Error('Unverified preview. Stop.');
  const bytes = fromBase64(p.unsignedBytes);
  await assertExactBytes(bytes, p.plan);
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes))),
  )
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
  if (hash !== p.sha256) throw new Error('Unsigned transaction hash mismatch.');
  const expiry = Date.parse(p.reviewExpiresAt);
  if (!Number.isFinite(expiry)) throw new Error('Invalid review timestamp.');
  const freshness = () =>
    set(
      'status',
      Date.now() > expiry
        ? 'Preview is stale. It remains readable; rerun the read-only preparation before any approval. Signing stays disabled.'
        : `Simulation succeeded with real coins and checks enabled at ${p.checkedAt}. Unsigned review only; no transaction sent.`,
    );
  freshness();
  setInterval(freshness, 30_000);
  definition('terms', {
    'Network / asset': 'Sui Mainnet / native SUI (9 decimals)',
    'Sender, destination and gas owner (all Wallet A)': p.plan.payer,
    'Conversion amount': `${formatSui(p.amountMist)} SUI (${p.amountMist} MIST)`,
    'Gas sponsor': 'None. Wallet A pays gas from existing coin objects.',
    'Gas cap': `${formatSui(p.gasBudgetMist)} SUI (${p.gasBudgetMist} MIST)`,
    'Maximum coin reduction (conversion plus gas cap)': `${formatSui(AMOUNT + GAS_BUDGET)} SUI; 0.005 stays yours as address balance`,
    'On-chain expiration': `End of epoch ${p.plan.expirationEpoch}; object versions also prevent replay`,
    'Review expires': p.reviewExpiresAt,
  });
  const table = document.createElement('table');
  for (const row of [
    ['Wallet A custody', 'Before (SUI)', 'Expected after (SUI)'],
    ...(['total', 'coins', 'address'] as const).map((k) => [
      k,
      formatSui(p.before[k]),
      formatSui(p.expected[k]),
    ]),
  ]) {
    const tr = document.createElement('tr');
    for (const text of row) {
      const td = document.createElement('td');
      td.textContent = text;
      tr.append(td);
    }
    table.append(tr);
  }
  element('balances').append(table);
  definition('gas', {
    'Estimated net gas': `${formatSui(p.simulation.estimatedNetGasMist)} SUI`,
    'Minimum coins left at full gas cap': `${formatSui(p.expected.minimumCoinsAfterGasCap)} SUI`,
    ...Object.fromEntries(Object.entries(p.simulation.gas).map(([k, v]) => [k, `${v} MIST`])),
  });
  set('decoded', JSON.stringify(Transaction.from(bytes).getData(), null, 2));
  set('bytes', p.unsignedBytes);
  set(
    'identity',
    `Unsigned digest (not an executed transaction): ${p.unsignedDigest}\nSHA-256: ${p.sha256}`,
  );
  button('copy').disabled = false;
  button('copy').onclick = async () => {
    await navigator.clipboard.writeText(p.plan.payer);
    button('copy').textContent = 'Wallet A address copied';
  };

  const registry = getWallets();
  let connectedWallet: ReturnType<typeof registry.get>[number] | undefined;
  let unsubscribe: (() => void) | undefined;
  async function connect(wallet: ReturnType<typeof registry.get>[number]) {
    try {
      set(
        'connection',
        'Slush connection requested. Select existing Wallet A; reject any transaction request or security warning.',
      );
      const feature = wallet.features['standard:connect'] as
        | {
            connect: () => Promise<{
              accounts: readonly {
                address: string;
                chains: readonly string[];
                features: readonly string[];
              }[];
            }>;
          }
        | undefined;
      if (!feature) throw new Error('Wallet does not support connection.');
      const result = await feature.connect();
      const account = result.accounts.find((a) => a.address.toLowerCase() === p.plan.payer);
      if (!account || !account.chains.includes(CHAIN))
        throw new Error(
          'Connected account is not the configured Mainnet Wallet A. Stop and select the correct existing account.',
        );
      connectedWallet = wallet;
      unsubscribe?.();
      const events = wallet.features['standard:events'] as
        { on: (event: 'change', fn: () => void) => () => void } | undefined;
      unsubscribe = events?.on('change', () => {
        connectedWallet = undefined;
        set(
          'connection',
          'Wallet accounts changed. Reconnect and verify Wallet A. Signing remains disabled.',
        );
      });
      const sign =
        account.features.includes('sui:signTransaction') &&
        !!wallet.features['sui:signTransaction'];
      set(
        'connection',
        `Wallet A matches exactly; account lists Sui Mainnet. Sign-only capability ${sign ? 'advertised' : 'not available'}. Google-login signing and account control are untested. No signature requested. Signing remains disabled.`,
      );
    } catch (error) {
      connectedWallet = undefined;
      set(
        'connection',
        error instanceof Error && error.message.startsWith('Connected account')
          ? error.message
          : 'Connection unavailable or declined. Stop on any Slush warning. No transaction sent.',
      );
    }
  }
  const list = () => {
    const container = element('wallets');
    container.replaceChildren();
    const wallets = registry.get().filter((w) => w.name === 'Slush' && w.chains.includes(CHAIN));
    if (!wallets.length) {
      container.textContent =
        'No Slush extension detected. Open this page in the browser with your existing extension, or use the official web-wallet connection below.';
      return;
    }
    for (const w of wallets) {
      const b = document.createElement('button');
      b.textContent = `Connect existing Slush account (${w.id || 'Wallet Standard'})`;
      b.onclick = () => void connect(w);
      container.append(b);
    }
  };
  registry.on('register', list);
  registry.on('unregister', () => {
    connectedWallet = undefined;
    set('connection', 'Wallet availability changed. Reconnect if needed.');
    list();
  });
  button('discover').disabled = false;
  button('discover').onclick = list;
  button('web').disabled = false;
  button('web').onclick = async () => {
    button('web').disabled = true;
    try {
      const { registerSlushWallet } = await import('@mysten/slush-wallet');
      const registered = registerSlushWallet('SUI self-deposit · unsigned local review');
      if (registered) await connect(registered.wallet);
      else set('connection', 'Web adapter could not initialize. No transaction sent.');
      list();
    } catch {
      set('connection', 'Official web-wallet connection unavailable. No transaction sent.');
    } finally {
      button('web').disabled = false;
    }
  };
  window.addEventListener('beforeunload', () => {
    unsubscribe?.();
    connectedWallet = undefined;
  });
  // Deliberately no signTransaction, signAndExecuteTransaction, executeTransaction
  // or personal-message call. Connection and public capability checks only.
  void connectedWallet;
}
init().catch(() =>
  set(
    'status',
    'Preview validation failed. Stop. No wallet connection, signature or transaction is available.',
  ),
);
