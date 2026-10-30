import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { normalizeSuiAddress, toBase64 } from '@mysten/sui/utils';
import { selfDeposit, ASSET, CHAIN, GENESIS } from '../tools/sui-self-deposit/transaction';
import {
  ConversionWorkflow,
  validatePrepared,
  type Authorization,
  type Prepared,
  type Verification,
} from '../tools/sui-self-deposit/workflow';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});
async function fixture() {
  const dir = await mkdtemp(`${tmpdir()}/payguard-conversion-`);
  directories.push(dir);
  const plan = {
    payer: normalizeSuiAddress('0xa'),
    gasPrice: '100',
    expirationEpoch: 1297,
    coins: [
      {
        objectId: normalizeSuiAddress('0xc'),
        version: '1',
        digest: '11111111111111111111111111111111',
      },
    ],
  };
  const tx = selfDeposit(plan),
    bytes = await tx.build();
  let now = Date.now();
  const p: Prepared = {
    plan,
    chain: CHAIN,
    genesis: GENESIS,
    amountMist: '5000000',
    gasBudgetMist: '2000000',
    unsignedBytes: toBase64(bytes),
    unsignedDigest: await tx.getDigest(),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    checkedAt: new Date(now).toISOString(),
    reviewExpiresAt: new Date(now + 900000).toISOString(),
    before: { total: '27993344', coins: '27993344', address: '0' },
    simulation: { success: true, checksEnabled: true, gasPaymentMocked: false },
  };
  const a: Authorization = {
    payer: plan.payer,
    chain: CHAIN,
    asset: ASSET,
    amountMist: '5000000',
    gasBudgetMist: '2000000',
    sha256: p.sha256,
    expiresAt: p.reviewExpiresAt,
    ownerApproval: 'Isolated test fixture approval, no live chain calls',
  };
  const services = {
    verifySignature: vi.fn(async () => {}),
    submit: vi.fn(async () => {}),
    reconcile: vi.fn(async (): Promise<Verification> => ({
      status: 'pending',
      checkedAt: new Date(now).toISOString(),
    })),
  };
  const make = (auth: Authorization | null = a) =>
    new ConversionWorkflow(dir, p, auth, services, () => now);
  return {
    dir,
    p,
    a,
    services,
    make,
    advance: () => {
      now += 900001;
    },
    claim: (w: ConversionWorkflow) => w.claim(p.sha256, p.plan.payer, CHAIN),
  };
}
describe('owner-approved local conversion single-attempt safety', () => {
  it('validates the full prepared bytes, owner binding and hash before enabling', async () => {
    const f = await fixture();
    await expect(validatePrepared(f.p, f.p.plan.payer)).resolves.toBeUndefined();
    await expect(
      validatePrepared({ ...f.p, amountMist: '5000001' }, f.p.plan.payer),
    ).rejects.toThrow('differs');
    await expect(
      validatePrepared({ ...f.p, sha256: '0'.repeat(64) }, f.p.plan.payer),
    ).rejects.toThrow('differs');
    await expect(validatePrepared(f.p, normalizeSuiAddress('0xb'))).rejects.toThrow('differs');
  });
  it('requires exact authorization and rejects expiration without any signature or RPC', async () => {
    const f = await fixture();
    await expect(f.claim(f.make(null))).rejects.toThrow('missing');
    await expect(f.claim(f.make({ ...f.a, gasBudgetMist: '3000000' }))).rejects.toThrow('missing');
    f.advance();
    await expect(f.claim(f.make())).rejects.toThrow('expired');
    expect(f.services.submit).not.toHaveBeenCalled();
  });
  it('rejects different accounts and networks before creating an attempt', async () => {
    const f = await fixture(),
      w = f.make();
    await expect(w.claim(f.p.sha256, normalizeSuiAddress('0xb'), CHAIN)).rejects.toThrow(
      'do not match',
    );
    await expect(w.claim(f.p.sha256, f.p.plan.payer, 'sui:testnet')).rejects.toThrow(
      'do not match',
    );
    expect(await w.state()).toBeNull();
  });
  it('never submits on claim/sign; duplicate concurrent submissions execute only once', async () => {
    const f = await fixture(),
      w = f.make();
    await f.claim(w);
    await w.signed(f.p.unsignedBytes, 'fixture-only-signature');
    expect(f.services.submit).not.toHaveBeenCalled();
    const results = await Promise.allSettled([w.submit(f.p.sha256), w.submit(f.p.sha256)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(f.services.submit).toHaveBeenCalledTimes(1);
    await expect(f.make().submit(f.p.sha256)).rejects.toThrow('locked');
  });
  it('durably records submission BEFORE network access and locks uncertain outcomes across restarts', async () => {
    const f = await fixture(),
      w = f.make();
    await f.claim(w);
    await w.signed(f.p.unsignedBytes, 'fixture-only-signature');
    f.services.submit.mockImplementation(async () => {
      expect(JSON.parse(await readFile(`${f.dir}/attempt.json`, 'utf8')).phase).toBe('submitting');
      throw new Error('fixture transport timeout after request');
    });
    expect((await w.submit(f.p.sha256)).phase).toBe('uncertain');
    await w.reconcile();
    await expect(f.make().submit(f.p.sha256)).rejects.toThrow('locked');
    await expect(f.claim(f.make())).rejects.toThrow('already exists');
    expect(f.services.submit).toHaveBeenCalledTimes(1);
  });
  it('locks a cancelled wallet request without an automatic retry', async () => {
    const f = await fixture(),
      w = f.make();
    await f.claim(w);
    await w.stop();
    await expect(f.claim(w)).rejects.toThrow('already exists');
    await expect(w.signed(f.p.unsignedBytes, 'fixture')).rejects.toThrow('locked');
    expect(f.services.submit).not.toHaveBeenCalled();
  });
  it('rejects modified wallet bytes and invalid signatures without submission', async () => {
    const f = await fixture(),
      w = f.make();
    await f.claim(w);
    await expect(w.signed('changed-by-wallet', 'fixture')).rejects.toThrow('changed');
    expect((await w.state())?.phase).toBe('stopped');
    expect(f.services.verifySignature).not.toHaveBeenCalled();
    const g = await fixture(),
      v = g.make();
    await g.claim(v);
    g.services.verifySignature.mockRejectedValue(new Error('fixture invalid signature'));
    await expect(v.signed(g.p.unsignedBytes, 'fixture')).rejects.toThrow('validation');
    expect(g.services.submit).not.toHaveBeenCalled();
  });
  it('keeps the signed attempt but prohibits submission after expiry', async () => {
    const f = await fixture(),
      w = f.make();
    await f.claim(w);
    await w.signed(f.p.unsignedBytes, 'fixture');
    f.advance();
    await expect(w.submit(f.p.sha256)).rejects.toThrow('expired');
    expect((await w.state())?.phase).toBe('signed');
    expect(f.services.submit).not.toHaveBeenCalled();
  });
  it('retains confirmed independent evidence and never resets the execution lock', async () => {
    const f = await fixture(),
      w = f.make();
    await f.claim(w);
    await w.signed(f.p.unsignedBytes, 'fixture');
    await w.submit(f.p.sha256);
    f.services.reconcile.mockResolvedValue({
      status: 'confirmed',
      checkedAt: new Date().toISOString(),
      digest: f.p.unsignedDigest,
    });
    expect((await w.reconcile()).phase).toBe('confirmed');
    f.services.reconcile.mockRejectedValue(new Error('later outage'));
    expect((await w.reconcile()).phase).toBe('confirmed');
    await expect(w.submit(f.p.sha256)).rejects.toThrow('locked');
  });
});
