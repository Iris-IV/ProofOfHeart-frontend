"use client";

import { useQuery } from "@tanstack/react-query";
import { Horizon } from "@stellar/stellar-sdk";
import { useWindowVisibility } from "./useWindowVisibility";
import { getStellarNetworkKey } from "@/lib/getStellarBalance";

export const STELLAR_BALANCES_QUERY_KEY = "stellarBalances";

interface BalanceResult {
  assetCode: string;
  balance: number;
}

interface UseStellarBalancesResult {
  balances: Map<string, number> | null;
  isLoading: boolean;
  error: Error | null;
}

function getHorizonServerUrl(): string {
  return getStellarNetworkKey() === "testnet"
    ? "https://horizon-testnet.stellar.org"
    : "https://horizon.stellar.org";
}

/**
 * Fetch multiple asset balances in a single request.
 * #1502: Multi-Token Contract Balance Polling Optimization
 */
async function getStellarBalances(publicKey: string): Promise<Map<string, number>> {
  const server = new Horizon.Server(getHorizonServerUrl());
  try {
    const account = await server.loadAccount(publicKey);
    const balances = new Map<string, number>();

    for (const balance of account.balances) {
      const asset_type = balance as { asset_type: string; balance: string; asset_code?: string };
      const code =
        asset_type.asset_type === "native"
          ? "XLM"
          : (asset_type as { asset_code?: string }).asset_code || "UNKNOWN";
      balances.set(code, parseFloat(asset_type.balance));
    }

    return balances;
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "response" in error &&
      error.response &&
      typeof error.response === "object" &&
      "status" in error.response &&
      error.response.status === 404
    ) {
      return new Map();
    }
    throw error;
  }
}

/**
 * Hook to fetch and poll multiple Stellar asset balances for a given account.
 * Optimized for batch queries with adaptive polling based on page visibility.
 * Falls back to empty map for non-existent accounts (404).
 */
export function useStellarBalances(publicKey: string | null): UseStellarBalancesResult {
  const network = getStellarNetworkKey();
  const visibility = useWindowVisibility();

  const { data, isLoading, error } = useQuery<Map<string, number>, Error>({
    queryKey: [STELLAR_BALANCES_QUERY_KEY, publicKey, network],
    queryFn: () => getStellarBalances(publicKey!),
    enabled: !!publicKey,
    staleTime: visibility.pollInterval,
    refetchInterval: publicKey && visibility.isVisible ? visibility.pollInterval : false,
    refetchIntervalInBackground: false,
    retry: 1,
  });

  return {
    balances: data ?? null,
    isLoading,
    error: error ?? null,
  };
}
