"use client";

import { useQuery } from "@tanstack/react-query";
import { getStellarBalance, getStellarNetworkKey } from "@/lib/getStellarBalance";

export const STELLAR_BALANCE_QUERY_KEY = "stellarBalance";

interface UseStellarBalanceResult {
  balance: number | null;
  isLoading: boolean;
  error: Error | null;
}

export function useStellarBalance(publicKey: string | null): UseStellarBalanceResult {
  const network = getStellarNetworkKey();

  const { data, isLoading, error } = useQuery<number, Error>({
    queryKey: [STELLAR_BALANCE_QUERY_KEY, publicKey, network],
    queryFn: () => getStellarBalance(publicKey!),
    enabled: !!publicKey,
    staleTime: 60_000,
    retry: 1,
  });

  return {
    balance: data ?? null,
    isLoading,
    error: error ?? null,
  };
}
