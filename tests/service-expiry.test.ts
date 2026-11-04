import { expect, it } from 'vitest';
import {
  assessServiceExpiry,
  EXPIRY_RULES,
  type ServiceExpiryEvidence,
} from '@/lib/service-expiry';
import { MAINNET_GENESIS } from '@/lib/service-protocol';
const window = { digest: 'SYNTHETIC_DIGEST', minEpoch: '1300', maxEpoch: '1301' };
const evidence = (): ServiceExpiryEvidence[] =>
  (['tatum', 'sui-fullnode'] as const).map((provider) => ({
    provider,
    digest: window.digest,
    checkedAt: new Date().toISOString(),
    genesis: MAINNET_GENESIS,
    epoch: '1302',
    protocolVersion: EXPIRY_RULES.protocolVersion,
    expirationEnabled: true,
    checkpoint: '210',
    lowestCheckpoint: '1',
    firstValidCheckpoint: '100',
    lastValidCheckpoint: '199',
    boundaryDigest: 'SYNTHETIC_BOUNDARY',
    boundaryEpoch: '1301',
    boundaryClosed: true,
    transaction: { outcome: 'not-found' },
  }));
it('requires strictly later epochs, not an expired quote or one missing digest', () => {
  const e = evidence();
  expect(assessServiceExpiry(window, e).eligible).toBe(true);
  for (const epoch of ['1300', '1301']) {
    expect(
      assessServiceExpiry(
        window,
        e.map((v) => ({ ...v, epoch })),
      ).reason,
    ).toBe('VALIDITY_ACTIVE');
  }
  expect(assessServiceExpiry(window, [e[0]]).eligible).toBe(false);
  expect(assessServiceExpiry(window, [e[0], e[0]]).eligible).toBe(false);
});
it.each(['tatum', 'sui-fullnode'])('keeps holds when %s is unavailable', (provider) => {
  expect(
    assessServiceExpiry(
      window,
      evidence().map((e) => (e.provider === provider ? { ...e, error: 'UNAVAILABLE' } : e)),
    ).reason,
  ).toBe('PROVIDER_UNAVAILABLE');
});
it('blocks conflicting, finalized, incomplete and wrong-digest responses without asserting failure', () => {
  for (const patch of [
    { transaction: { outcome: 'found' as const, checkpoint: '150', success: true } },
    { transaction: { outcome: 'found' as const, checkpoint: '150', success: false } },
    { transaction: { outcome: 'unknown' as const } },
    { digest: 'OTHER_DIGEST' },
    { genesis: 'wrong-chain' },
    { epoch: '1303' },
    { boundaryDigest: 'OTHER_BOUNDARY' },
    { firstValidCheckpoint: '101' },
  ]) {
    const e = evidence();
    Object.assign(e[1], patch);
    expect(assessServiceExpiry(window, e).eligible).toBe(false);
  }
});
it('requires retained transaction history, a closed final epoch checkpoint and fresh reviewed protocol evidence', () => {
  for (const patch of [
    { lowestCheckpoint: '101' },
    { lowestCheckpoint: undefined },
    { checkpoint: '199' },
    { boundaryClosed: false },
    { boundaryEpoch: '1300' },
    { lastValidCheckpoint: undefined },
    { protocolVersion: '140' },
    { expirationEnabled: false },
    { checkedAt: '2020-01-01T00:00:00Z' },
    { checkedAt: new Date(Date.now() + 120000).toISOString() },
  ]) {
    const e = evidence();
    Object.assign(e[0], patch);
    expect(assessServiceExpiry(window, e).eligible).toBe(false);
  }
  expect(assessServiceExpiry({ ...window, maxEpoch: '99999' }, evidence()).eligible).toBe(false);
});
