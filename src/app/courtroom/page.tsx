import type { Metadata } from 'next';
import { MemoryCourtroom } from '@/components/memory-courtroom';
export const metadata: Metadata = {
  title: 'Memory Courtroom',
  description:
    'Compare Memory OFF and ON, inspect genuine Walrus provenance and three verified Mainnet x402 purchases. Free public replay.',
};
export default function CourtroomPage() {
  return <MemoryCourtroom />;
}
