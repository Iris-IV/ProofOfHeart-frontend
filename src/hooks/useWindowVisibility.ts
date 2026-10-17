"use client";

import { useSyncExternalStore } from "react";

// Polling rate constants for different visibility states
export const POLLING_RATES = {
  // Foreground: aggressive polling for real-time updates
  foreground: { interval: 5_000, maxBackoff: 30_000 },
  // Background: reduced polling to conserve resources
  background: { interval: 30_000, maxBackoff: 120_000 },
  // Hidden: minimal polling to preserve battery and bandwidth
  hidden: { interval: 60_000, maxBackoff: 300_000 },
} as const;

export type VisibilityState = "visible" | "hidden" | "prerender";

function subscribe(callback: () => void) {
  window.addEventListener("visibilitychange", callback);
  return () => window.removeEventListener("visibilitychange", callback);
}

function getSnapshot(): VisibilityState {
  if (typeof document === "undefined") return "visible";
  return (document.visibilityState as VisibilityState) || "visible";
}

function getServerSnapshot(): VisibilityState {
  return "visible";
}

export interface VisibilityInfo {
  isVisible: boolean;
  state: VisibilityState;
  pollInterval: number;
  maxBackoff: number;
}

/**
 * Hook that returns visibility state and adaptive polling rates.
 * Reduces server load when tab is hidden by adapting polling intervals.
 * #1520: Polling Rate Adaptation Based on Page Visibility
 */
export function useWindowVisibility(): VisibilityInfo {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isVisible = state === "visible";

  const pollConfig =
    state === "visible"
      ? POLLING_RATES.foreground
      : state === "hidden"
        ? POLLING_RATES.hidden
        : POLLING_RATES.background;

  return {
    isVisible,
    state,
    pollInterval: pollConfig.interval,
    maxBackoff: pollConfig.maxBackoff,
  };
}
