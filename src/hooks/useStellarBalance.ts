"use client";

import { useQuery } from "@tanstack/react-query";
import { getStellarBalance, getStellarNetworkKey } from "@/lib/getStellarBalance";
import { useWindowVisibility } from "./useWindowVisibility";

export const STELLAR_BALANCE_QUERY_KEY = "stellarBalance";

/**
 * Wallet balance refresh cadence (#1144).
 * Kept in the 10–30s band so the dashboard stays fresh without the prior
 * aggressive ~2s Horizon chatter.
 */
export const STELLAR_BALANCE_POLL_MS = Math.min(
  30_000,
  Math.max(
    10_000,
    Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_BALANCE_MS) || 15_000,
  ),
);

interface UseStellarBalanceResult {
  balance: number | null;
  isLoading: boolean;
  error: Error | null;
}

export function useStellarBalance(publicKey: string | null): UseStellarBalanceResult {
  const network = getStellarNetworkKey();
  const isVisible = useWindowVisibility();

  const { data, isLoading, error } = useQuery<number, Error>({
    queryKey: [STELLAR_BALANCE_QUERY_KEY, publicKey, network],
    queryFn: () => getStellarBalance(publicKey!),
    enabled: !!publicKey,
    staleTime: STELLAR_BALANCE_POLL_MS,
    refetchInterval: publicKey && isVisible ? STELLAR_BALANCE_POLL_MS : false,
    refetchIntervalInBackground: false,
    retry: 1,
  });

  return {
    balance: data ?? null,
    isLoading,
    error: error ?? null,
  };
}
