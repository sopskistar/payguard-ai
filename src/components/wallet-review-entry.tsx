'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
const ReviewKit = dynamic(() => import('./wallet-review-kit'), {
  ssr: false,
  loading: () => <p role="status">Loading the official wallet selector…</p>,
});
export function WalletReviewEntry() {
  const [opened, setOpened] = useState(false);
  return opened ? (
    <ReviewKit />
  ) : (
    <button className="button primary full" onClick={() => setOpened(true)}>
      Open Slush Security Review
    </button>
  );
}
