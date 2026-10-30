import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename } from 'node:fs/promises';
import { fromBase64 } from '@mysten/sui/utils';
import { Transaction } from '@mysten/sui/transactions';
import {
  AMOUNT,
  ASSET,
  CHAIN,
  GAS_BUDGET,
  GENESIS,
  assertExactBytes,
  type Plan,
} from './transaction';

export type Prepared = {
  plan: Plan;
  sha256: string;
  unsignedDigest: string;
  unsignedBytes: string;
  chain: string;
  genesis: string;
  amountMist: string;
  gasBudgetMist: string;
  checkedAt: string;
  reviewExpiresAt: string;
  before: { total: string; coins: string; address: string };
  simulation: { success: boolean; checksEnabled: boolean; gasPaymentMocked: boolean };
};
export type Authorization = {
  payer: string;
  chain: string;
  asset: string;
  amountMist: string;
  gasBudgetMist: string;
  sha256: string;
  expiresAt: string;
  ownerApproval: string;
};
export type Verification = {
  status: 'confirmed' | 'finalized_failed' | 'pending' | 'uncertain' | 'balance_mismatch';
  checkedAt: string;
  [key: string]: unknown;
};
export type Attempt = {
  phase:
    | 'awaiting_wallet'
    | 'signed'
    | 'submitting'
    | 'submitted'
    | 'uncertain'
    | 'stopped'
    | 'confirmed'
    | 'finalized_failed'
    | 'balance_mismatch';
  digest: string;
  sha256: string;
  createdAt: string;
  updatedAt: string;
  detail?: string;
  verification?: Verification;
};
export class FlowError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function validatePrepared(p: Prepared, payer: string) {
  const bytes = fromBase64(p.unsignedBytes);
  await assertExactBytes(bytes, p.plan);
  if (
    p.plan.payer !== payer ||
    p.chain !== CHAIN ||
    p.genesis !== GENESIS ||
    p.amountMist !== AMOUNT.toString() ||
    p.gasBudgetMist !== GAS_BUDGET.toString() ||
    !p.simulation.success ||
    !p.simulation.checksEnabled ||
    p.simulation.gasPaymentMocked ||
    createHash('sha256').update(bytes).digest('hex') !== p.sha256 ||
    (await Transaction.from(bytes).getDigest()) !== p.unsignedDigest
  )
    throw new FlowError(
      'PREVIEW_INVALID',
      'Preview differs from the exact Mainnet Wallet A self-deposit.',
    );
}

// Atomic durable state precedes signature disclosure and the only execution RPC.
// No failed/uncertain/cancelled phase can re-enter signing or submission.
export class ConversionWorkflow {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    readonly dir: string,
    readonly preview: Prepared,
    readonly authorization: Authorization | null,
    private services: {
      verifySignature: (bytes: Uint8Array, signature: string) => Promise<void>;
      submit: (bytes: Uint8Array, signature: string) => Promise<void>;
      reconcile: () => Promise<Verification>;
    },
    private now = () => Date.now(),
  ) {}
  private async locked<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn);
    this.queue = next.catch(() => {});
    return next;
  }
  private async save(name: string, value: unknown, exclusive = false) {
    await mkdir(this.dir, { recursive: true });
    const file = `${this.dir}/${name}`;
    const temporary = exclusive ? file : file + '.tmp';
    const handle = await open(temporary, exclusive ? 'wx' : 'w', 0o600);
    try {
      await handle.writeFile(JSON.stringify(value, null, 2) + '\n');
      await handle.sync();
    } finally {
      await handle.close();
    }
    if (!exclusive) await rename(temporary, file);
  }
  async state(): Promise<Attempt | null> {
    try {
      return JSON.parse(await readFile(`${this.dir}/attempt.json`, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }
  private approved() {
    const a = this.authorization,
      p = this.preview;
    if (
      !a ||
      a.payer !== p.plan.payer ||
      a.chain !== CHAIN ||
      a.asset !== ASSET ||
      a.amountMist !== AMOUNT.toString() ||
      a.gasBudgetMist !== GAS_BUDGET.toString() ||
      a.sha256 !== p.sha256 ||
      !a.ownerApproval ||
      a.expiresAt !== p.reviewExpiresAt
    )
      throw new FlowError('NOT_AUTHORIZED', 'Exact localhost conversion authorization is missing.');
    const expiry = Date.parse(a.expiresAt),
      checked = Date.parse(p.checkedAt);
    if (
      !Number.isFinite(expiry) ||
      !Number.isFinite(checked) ||
      this.now() >= expiry ||
      checked > this.now() + 5000 ||
      expiry - checked > 15 * 60_000
    )
      throw new FlowError('EXPIRED', 'Preview expired. No new signing or submission is allowed.');
  }
  availability() {
    try {
      this.approved();
      return true;
    } catch {
      return false;
    }
  }
  private async update(
    a: Attempt,
    phase: Attempt['phase'],
    detail?: string,
    verification?: Verification,
  ) {
    const next = {
      ...a,
      phase,
      updatedAt: new Date(this.now()).toISOString(),
      detail,
      verification: verification ?? a.verification,
    };
    await this.save('attempt.json', next);
    return next;
  }
  async claim(sha: string, address: string, chain: string) {
    return this.locked(async () => {
      this.approved();
      if (sha !== this.preview.sha256 || address !== this.preview.plan.payer || chain !== CHAIN)
        throw new FlowError('TERMS_CHANGED', 'Wallet or transaction terms do not match.');
      if (await this.state())
        throw new FlowError(
          'ATTEMPT_EXISTS',
          'An attempt already exists. Reconcile its digest; do not sign again.',
        );
      await this.save('attempt-preview.json', this.preview, true);
      const now = new Date(this.now()).toISOString();
      const a: Attempt = {
        phase: 'awaiting_wallet',
        digest: this.preview.unsignedDigest,
        sha256: sha,
        createdAt: now,
        updatedAt: now,
      };
      await this.save('attempt.json', a, true);
      return a;
    });
  }
  async signed(bytes: string, signature: string) {
    return this.locked(async () => {
      const a = await this.state();
      if (!a || a.phase !== 'awaiting_wallet')
        throw new FlowError('SIGNATURE_LOCKED', 'Signature collection is locked for this attempt.');
      try {
        if (bytes !== this.preview.unsignedBytes || !signature || signature.length > 65536)
          throw new FlowError(
            'SIGNED_TERMS_CHANGED',
            'Slush returned changed bytes or an invalid signature.',
          );
        await assertExactBytes(fromBase64(bytes), this.preview.plan);
        await this.services.verifySignature(fromBase64(bytes), signature);
        await this.save('signed.json', { bytes, signature }, true);
        return await this.update(
          a,
          'signed',
          'Signature verified for exact Wallet A bytes. Not submitted.',
        );
      } catch (error) {
        await this.update(
          a,
          'stopped',
          'Signature check failed or was unavailable. No submission made; do not request another signature.',
        );
        throw error instanceof FlowError
          ? error
          : new FlowError(
              'SIGNATURE_UNVERIFIED',
              'Signature validation unavailable or unsuccessful. No submission made.',
            );
      }
    });
  }
  async stop() {
    return this.locked(async () => {
      const a = await this.state();
      if (a?.phase === 'awaiting_wallet')
        return this.update(a, 'stopped', 'Wallet request declined or failed. No automatic retry.');
      return a;
    });
  }
  async submit(sha: string) {
    return this.locked(async () => {
      this.approved();
      const a = await this.state();
      if (!a || a.phase !== 'signed' || sha !== this.preview.sha256)
        throw new FlowError(
          'SUBMISSION_LOCKED',
          'Submission is locked. Reconcile the existing digest; never resend automatically.',
        );
      const s = JSON.parse(await readFile(`${this.dir}/signed.json`, 'utf8'));
      if (s.bytes !== this.preview.unsignedBytes)
        throw new FlowError('SIGNED_TERMS_CHANGED', 'Stored signed bytes changed. Stop.');
      await assertExactBytes(fromBase64(s.bytes), this.preview.plan);
      // Persist this BEFORE touching the network. Restart/timeout cannot re-submit.
      await this.update(a, 'submitting', 'One execution request in progress; do not resend.');
      try {
        await this.services.submit(fromBase64(s.bytes), s.signature);
        return await this.update(
          a,
          'submitted',
          'Execution response received. Independent Tatum verification still required.',
        );
      } catch {
        return this.update(
          a,
          'uncertain',
          'Execution response uncertain. Check the existing digest through Tatum; do not resend.',
        );
      }
    });
  }
  async reconcile() {
    return this.locked(async () => {
      const a = await this.state();
      if (!a) throw new FlowError('NO_ATTEMPT', 'No attempt exists to reconcile.');
      if (a.phase === 'confirmed' || a.phase === 'finalized_failed') return a;
      const result = await this.services.reconcile();
      if (
        result.status === 'confirmed' ||
        result.status === 'finalized_failed' ||
        result.status === 'balance_mismatch'
      )
        return this.update(a, result.status, 'Independent Tatum reconciliation completed.', result);
      return this.update(
        a,
        a.phase === 'submitting' ? 'uncertain' : a.phase,
        'Tatum has not proven final success. No resubmission allowed.',
        result,
      );
    });
  }
}
