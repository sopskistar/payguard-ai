'use client';
import { useSyncExternalStore } from 'react';
const subscribe = () => () => {};
const browserReady = () => true;
const serverReady = () => false;
// Keep controls unavailable until their event handlers can actually run.
export function useClientReady() {
  return useSyncExternalStore(subscribe, browserReady, serverReady);
}
