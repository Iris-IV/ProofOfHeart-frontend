"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { isOffsetTrustworthy, nowWithOffset } from "../lib/serverTime";

export interface PendingDonation {
  id: string;
  campaignId: string;
  campaignTitle: string;
  amount: number;
  currency: string;
  timestamp: number;
  expiresAt: number;
}

const DEFAULT_GRACE_PERIOD_MS = 60_000; // 60 seconds
export { DEFAULT_GRACE_PERIOD_MS };

export function useDonationGracePeriod(
  gracePeriodMs: number = DEFAULT_GRACE_PERIOD_MS,
  serverOffsetMs: number | null = null,
) {
  const [pendingDonations, setPendingDonations] = useState<PendingDonation[]>([]);

  // Read through a ref so the interval below keeps a single identity instead of
  // being torn down and rebuilt on every offset update.
  const offsetRef = useRef(serverOffsetMs);
  offsetRef.current = serverOffsetMs;

  // Periodically purge expired donations and update remaining time
  useEffect(() => {
    const interval = setInterval(() => {
      const now = nowWithOffset(offsetRef.current);
      setPendingDonations((prev) => prev.filter((d) => d.expiresAt > now));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const startGracePeriod = useCallback(
    (donation: Omit<PendingDonation, "id" | "timestamp" | "expiresAt">) => {
      const now = nowWithOffset(serverOffsetMs);
      const newDonation: PendingDonation = {
        ...donation,
        id: `pending_${now}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: now,
        expiresAt: now + gracePeriodMs,
      };

      setPendingDonations((prev) => [newDonation, ...prev]);
      return newDonation;
    },
    [gracePeriodMs, serverOffsetMs],
  );

  const cancelDonation = useCallback((id: string) => {
    let cancelled: PendingDonation | undefined;
    setPendingDonations((prev) => {
      cancelled = prev.find((d) => d.id === id);
      return prev.filter((d) => d.id !== id);
    });
    return cancelled;
  }, []);

  const finalizeDonation = useCallback((id: string) => {
    setPendingDonations((prev) => prev.filter((d) => d.id !== id));
  }, []);

  return {
    pendingDonations,
    startGracePeriod,
    cancelDonation,
    finalizeDonation,
    /** False when the server clock is unknown or implausibly far from the local one. */
    clockTrustworthy: isOffsetTrustworthy(serverOffsetMs),
  };
}
