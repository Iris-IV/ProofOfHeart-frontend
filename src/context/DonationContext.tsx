"use client";

import React, { createContext, useContext, useMemo, ReactNode, useCallback, useRef } from "react";
import { useDonationGracePeriod, DEFAULT_GRACE_PERIOD_MS } from "../hooks/useDonationGracePeriod";
import { useServerTimeOffset } from "../hooks/useServerTimeOffset";
import { CancelDonationBanner } from "../components/CancelDonationBanner";
import type { DonationContextType } from "../types";

const DonationContext = createContext<DonationContextType | null>(null);

export function DonationProvider({ children }: { children: ReactNode }) {
  // Server-confirmed clock delta, so grace periods don't drift with a wrong
  // local system clock (#1212).
  const serverOffsetMs = useServerTimeOffset();

  const { pendingDonations, startGracePeriod, cancelDonation, finalizeDonation } =
    useDonationGracePeriod(DEFAULT_GRACE_PERIOD_MS, serverOffsetMs);

  // Keep latest functions in refs to provide stable callbacks, preventing
  // consumers from re-rendering when the provider re-renders due to unrelated events.
  const startGracePeriodRef = useRef(startGracePeriod);
  startGracePeriodRef.current = startGracePeriod;
  const cancelDonationRef = useRef(cancelDonation);
  cancelDonationRef.current = cancelDonation;
  const finalizeDonationRef = useRef(finalizeDonation);
  finalizeDonationRef.current = finalizeDonation;

  const stableStartGracePeriod = useCallback(
    (...args: Parameters<typeof startGracePeriod>) => startGracePeriodRef.current(...args),
    [],
  );
  const stableCancelDonation = useCallback(
    (...args: Parameters<typeof cancelDonation>) => cancelDonationRef.current(...args),
    [],
  );
  const stableFinalizeDonation = useCallback(
    (...args: Parameters<typeof finalizeDonation>) => finalizeDonationRef.current(...args),
    [],
  );

  // Memoize context value to avoid re-rendering consumers when unrelated state updates
  const value = useMemo(
    () => ({
      pendingDonations,
      startGracePeriod: stableStartGracePeriod,
      cancelDonation: stableCancelDonation,
      finalizeDonation: stableFinalizeDonation,
    }),
    [pendingDonations, stableStartGracePeriod, stableCancelDonation, stableFinalizeDonation],
  );

  return (
    <DonationContext.Provider value={value}>
      {children}
      <CancelDonationBanner
        pendingDonations={pendingDonations}
        onCancel={cancelDonation}
        serverOffsetMs={serverOffsetMs}
      />
    </DonationContext.Provider>
  );
}

export function useDonationContext() {
  const context = useContext(DonationContext);
  if (!context) {
    throw new Error("useDonationContext must be used within a DonationProvider");
  }
  return context;
}
