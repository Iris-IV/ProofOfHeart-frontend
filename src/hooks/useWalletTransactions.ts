"use client";

import { useQuery } from "@tanstack/react-query";
import { getWalletTransactions, WalletTransactionLogEntry } from "@/lib/transactionLog";

/**
 * Shared hook for fetching wallet transactions with a consistent React Query key.
 * This enables request deduplication across components that need wallet transaction data.
 */
export function useWalletTransactions(walletAddress: string | null) {
  const { data, isLoading, refetch } = useQuery<WalletTransactionLogEntry[]>({
    queryKey: ["wallet-transactions", walletAddress],
    queryFn: () => (walletAddress ? getWalletTransactions(walletAddress) : []),
    enabled: !!walletAddress,
    staleTime: 10_000,
  });

  return {
    transactions: data ?? [],
    isLoading,
    refetch,
  };
}
