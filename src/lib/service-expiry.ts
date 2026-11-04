// Deliberately restricted to the reviewed Mainnet protocol and our bounded template.
// A protocol upgrade requires a new source review; it never implicitly unlocks holds.
import { MAINNET_GENESIS } from './service-protocol';

export const EXPIRY_RULES = {
  protocolVersion: '139',
  sourceRevision: '485613f749ed',
  source: 'https://github.com/MystenLabs/sui/blob/485613f749ed/crates/sui-types/src/transaction.rs',
} as const;
export type ServiceExpiryWindow = { digest: string; minEpoch: string; maxEpoch: string };
export type ServiceExpiryEvidence = {
  provider: 'tatum' | 'sui-fullnode';
  checkedAt: string;
  digest: string;
  error?: string;
  genesis?: string;
  epoch?: string;
  protocolVersion?: string;
  expirationEnabled?: boolean;
  checkpoint?: string;
  lowestCheckpoint?: string;
  firstValidCheckpoint?: string;
  lastValidCheckpoint?: string;
  boundaryDigest?: string;
  boundaryEpoch?: string;
  boundaryClosed?: boolean;
  transaction?: {
    outcome: 'not-found' | 'found' | 'unknown';
    checkpoint?: string;
    success?: boolean;
  };
};
const integer = (v?: string) => (v !== undefined && /^\d+$/.test(v) ? BigInt(v) : null);
export function assessServiceExpiry(
  window: ServiceExpiryWindow,
  evidence: ServiceExpiryEvidence[],
  now = Date.now(),
) {
  const blocked = (reason: string) => ({ eligible: false, reason });
  const min = integer(window.minEpoch),
    max = integer(window.maxEpoch);
  if (min === null || max === null || max < min || max > min + 1n)
    return blocked('UNSUPPORTED_VALIDITY');
  if (
    evidence.length !== 2 ||
    new Set(evidence.map((e) => e.provider)).size !== 2 ||
    !evidence.some((e) => e.provider === 'tatum') ||
    !evidence.some((e) => e.provider === 'sui-fullnode')
  )
    return blocked('INDEPENDENT_PROVIDERS_REQUIRED');
  if (evidence.some((e) => e.error)) return blocked('PROVIDER_UNAVAILABLE');
  if (evidence.some((e) => e.genesis !== MAINNET_GENESIS || e.digest !== window.digest))
    return blocked('CHAIN_OR_DIGEST_MISMATCH');
  if (evidence.some((e) => e.transaction?.outcome === 'found'))
    return blocked('TRANSACTION_FOUND_RECONCILE');
  if (evidence.some((e) => e.transaction?.outcome !== 'not-found'))
    return blocked('TRANSACTION_UNCERTAIN');
  if (evidence.some((e) => integer(e.epoch) === null)) return blocked('EPOCH_UNAVAILABLE');
  if (evidence.some((e) => BigInt(e.epoch!) <= max)) return blocked('VALIDITY_ACTIVE');
  if (evidence[0].epoch !== evidence[1].epoch) return blocked('PROVIDERS_DISAGREE');
  if (
    evidence.some((e) => e.protocolVersion !== EXPIRY_RULES.protocolVersion || !e.expirationEnabled)
  )
    return blocked('PROTOCOL_REVIEW_REQUIRED');
  if (
    evidence.some(
      (e) =>
        !Number.isFinite(Date.parse(e.checkedAt)) ||
        now - Date.parse(e.checkedAt) < 0 ||
        now - Date.parse(e.checkedAt) > 60000,
    )
  )
    return blocked('STALE_EVIDENCE');
  if (
    evidence.some(
      (e) => !e.boundaryClosed || e.boundaryEpoch !== window.maxEpoch || !e.boundaryDigest,
    )
  )
    return blocked('EPOCH_BOUNDARY_UNCONFIRMED');
  if (
    evidence[0].boundaryDigest !== evidence[1].boundaryDigest ||
    evidence[0].firstValidCheckpoint !== evidence[1].firstValidCheckpoint ||
    evidence[0].lastValidCheckpoint !== evidence[1].lastValidCheckpoint
  )
    return blocked('PROVIDERS_DISAGREE');
  for (const e of evidence) {
    const first = integer(e.firstValidCheckpoint),
      last = integer(e.lastValidCheckpoint),
      lowest = integer(e.lowestCheckpoint),
      tip = integer(e.checkpoint);
    if (
      first === null ||
      last === null ||
      lowest === null ||
      tip === null ||
      first > last ||
      lowest > first ||
      tip <= last
    )
      return blocked('HISTORY_COVERAGE_UNPROVEN');
  }
  return { eligible: true, reason: 'EXPIRED_UNEXECUTED' };
}
