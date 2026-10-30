'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useClientReady } from './client-ready';
const ReviewKit = dynamic(() => import('./wallet-review-kit'), {
  ssr: false,
  loading: () => <p role="status">Loading the official wallet selector…</p>,
});
export function WalletReviewEntry() {
  const ready = useClientReady();
  const [opened, setOpened] = useState(false);
  return opened ? (
    <ReviewKit />
  ) : (
    <button className="button primary full" disabled={!ready} onClick={() => setOpened(true)}>
      Open Slush Security Review
    </button>
  );
}
