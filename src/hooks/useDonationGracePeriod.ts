'use client';

import { useState, useEffect, useCallback } from 'react';

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

export function useDonationGracePeriod(gracePeriodMs: number = DEFAULT_GRACE_PERIOD_MS) {
  const [pendingDonations, setPendingDonations] = useState<PendingDonation[]>([]);

  // Periodically purge expired donations and update remaining time
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setPendingDonations((prev) => prev.filter((d) => d.expiresAt > now));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const startGracePeriod = useCallback(
    (donation: Omit<PendingDonation, 'id' | 'timestamp' | 'expiresAt'>) => {
      const now = Date.now();
      const newDonation: PendingDonation = {
        ...donation,
        id: `pending_${now}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: now,
        expiresAt: now + gracePeriodMs,
      };

      setPendingDonations((prev) => [newDonation, ...prev]);
      return newDonation;
    },
    [gracePeriodMs]
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
  };
}
