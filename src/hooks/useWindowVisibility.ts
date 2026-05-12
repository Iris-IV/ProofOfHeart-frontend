'use client';

import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  window.addEventListener('visibilitychange', callback);
  return () => window.removeEventListener('visibilitychange', callback);
}

function getSnapshot() {
  return document.visibilityState === 'visible';
}

function getServerSnapshot() {
  return true; // Default to visible on server/during hydration
}

/**
 * A hook that returns true if the current window/tab is visible.
 * Uses useSyncExternalStore for optimal performance and hydration safety.
 */
export function useWindowVisibility() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
