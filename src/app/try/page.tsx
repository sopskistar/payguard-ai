import type { Metadata } from 'next';
import { JudgeSandbox } from '@/components/judge-sandbox';
export const metadata: Metadata = { title: 'Three-minute judge sandbox' };
export default function TryPage() {
  return <JudgeSandbox />;
}
