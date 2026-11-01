import { NextResponse } from 'next/server';
import proof from '../../../../docs/evidence/walrus-confirmed.json';
import courtroom from '../../../../docs/evidence/courtroom.json';
export const dynamic = 'force-dynamic';
export function GET() {
  return NextResponse.json(
    {
      application: 'PayGuard Verify',
      commit: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
      recordedProofCount: courtroom.confirmedMemories,
      ownerProofCount: proof.confirmedMemories.length,
      proofExportedAt: courtroom.capturedAt,
      modes: ['public-demo', 'owner-admin', 'wallet-member', 'recorded-proof'],
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
