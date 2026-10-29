import { NextResponse } from 'next/server';
import proof from '../../../../docs/evidence/walrus-confirmed.json';
export const dynamic = 'force-dynamic';
export function GET() {
  return NextResponse.json(
    {
      application: 'PayGuard Verify',
      commit: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
      recordedProofCount: proof.confirmedMemories.length,
      proofExportedAt: proof.exportedAt,
      modes: ['public-demo', 'owner-admin', 'wallet-member', 'recorded-proof'],
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
