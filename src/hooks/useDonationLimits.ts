"use client";

import { useQuery } from "@tanstack/react-query";
import { getDonationLimits } from "../lib/contractClient";
import type { DonationLimits } from "../lib/donationLimits";

/** Reads latest per-transaction/personal/campaign-lifetime caps in stroops. */
export function useDonationLimits(campaignId: number, userAddress: string | null) {
  const query = useQuery<DonationLimits, Error>({
    queryKey: ["donationLimits", campaignId, userAddress],
    queryFn: () => getDonationLimits(campaignId, userAddress!, true),
    enabled: Boolean(userAddress) && Number.isInteger(campaignId),
    staleTime: 5_000,
    refetchInterval: 12_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  return {
    limits: query.data ?? null,
    isLoading: query.isPending,
    error: query.error,
    refetch: query.refetch,
  };
}
