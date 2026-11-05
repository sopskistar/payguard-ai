// This temporary UI scope is the owner's explicit four-intent approval. The
// existing recovery endpoint still supplies all authorization and financial checks.
export type ApprovedServiceRecovery = {
  id: string;
  role: 'member' | 'owner';
  payer: string;
  digest: string;
  amountAtomic: string;
  minEpoch: string;
  maxEpoch: string;
};
const customer = '0xdce341eacb826d2a98abb80ed725bf38f0650a630789abb210e9a079c42365fa';
export const APPROVED_SERVICE_RECOVERIES: readonly ApprovedServiceRecovery[] = [
  {
    id: '544d939d-02d5-4d98-b549-69fb9fb501e8',
    role: 'member',
    payer: customer,
    digest: 'EDe8JMezpxR4qpWFiMQni6ETMdYfYXiM8Sdxnkzvse3s',
    amountAtomic: '1000000',
    minEpoch: '1300',
    maxEpoch: '1301',
  },
  {
    id: '7a025238-06d9-43ca-8b5f-16ef7079f086',
    role: 'member',
    payer: customer,
    digest: 'CcfxLSCtm6Nr6gZvLbif4dFYJTyt3ECCSDR4nMaQzGw6',
    amountAtomic: '1000000',
    minEpoch: '1300',
    maxEpoch: '1301',
  },
  {
    id: 'd23937ed-1907-4e40-8156-488f453a921a',
    role: 'member',
    payer: customer,
    digest: '7dDdwa2iHbGkXsmrk5wKT3TerFoQ46hMtEDaxq8vFiJR',
    amountAtomic: '1000000',
    minEpoch: '1300',
    maxEpoch: '1301',
  },
  {
    id: 'b0386342-a7c2-40ba-909e-9edf17501767',
    role: 'owner',
    payer: '0xc0f3fbf8a029fe354571b58d9e079c1aa4e9ca111a2b025dca470d4bc96397a8',
    digest: '7GiPuDNq1vN8pLn2cqJf8kYMrt9zmbdDBbAfdoYtGdRj',
    amountAtomic: '1000000',
    minEpoch: '1300',
    maxEpoch: '1301',
  },
];
export type ControlledRecoveryStatus = {
  enabled: boolean;
  checkedAt: string;
  scope: string | null;
  verified: boolean;
  allOriginalsClosed: boolean;
  issues: string[];
  nextId: string | null;
  records: {
    id: string;
    payer: string;
    digest: string;
    amountAtomic: string;
    state: string;
    recoveredVerified: boolean;
    auditId: string | null;
    releasedAtomic: string;
    issues: string[];
  }[];
  wallet: { reservedAtomic: string; liabilityAtomic: string } | null;
  sponsor: { reservedAtomic: string; liabilityAtomic: string } | null;
};
