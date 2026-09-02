"use client";

import React, { createContext, useContext, useMemo, ReactNode } from "react";
import { useDonationGracePeriod } from "../hooks/useDonationGracePeriod";
import type { DonationContextType } from "../types";

const DonationContext = createContext<DonationContextType | null>(null);

export function DonationProvider({ children }: { children: ReactNode }) {
  const { pendingDonations, startGracePeriod, cancelDonation, finalizeDonation } =
    useDonationGracePeriod();

  // Memoize context value to avoid re-rendering consumers when unrelated state updates
  const value = useMemo(
    () => ({
      pendingDonations,
      startGracePeriod,
      cancelDonation,
      finalizeDonation,
    }),
    [pendingDonations, startGracePeriod, cancelDonation, finalizeDonation],
  );

  return <DonationContext.Provider value={value}>{children}</DonationContext.Provider>;
}

export function useDonationContext() {
  const context = useContext(DonationContext);
  if (!context) {
    throw new Error("useDonationContext must be used within a DonationProvider");
  }
  return context;
}
