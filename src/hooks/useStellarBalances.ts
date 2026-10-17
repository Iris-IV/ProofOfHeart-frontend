"use client";

import { useQuery } from "@tanstack/react-query";
import { Horizon } from "@stellar/stellar-sdk";
import { useWindowVisibility } from "./useWindowVisibility";
import { getStellarNetworkKey, STELLAR_BALANCE_POLL_MS } from "@/lib/getStellarBalance";

export const STELLAR_BALANCES_QUERY_KEY = "stellarBalances";

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

async function getStellarBalances(publicKey: string): Promise<Map<string, number>> {
  const server = new Horizon.Server(getHorizonServerUrl());
  try {
    const account = await server.loadAccount(publicKey);
    const balances = new Map<string, number>();

    for (const balance of account.balances) {
      const b = balance as { asset_type: string; balance: string; asset_code?: string };
      const code = b.asset_type === "native" ? "XLM" : b.asset_code || "UNKNOWN";
      balances.set(code, parseFloat(b.balance));
    }

    return balances;
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "response" in error &&
      (error as { response?: { status?: number } }).response?.status === 404
    ) {
      return new Map();
    }
    throw error;
  }
}

/**
 * Fetch all asset balances in a single request for multi-token support.
 * #1502: Multi-Token Contract Balance Polling Optimization
 */
export function useStellarBalances(publicKey: string | null): UseStellarBalancesResult {
  const network = getStellarNetworkKey();
  const isVisible = useWindowVisibility();

  const { data, isLoading, error } = useQuery<Map<string, number>, Error>({
    queryKey: [STELLAR_BALANCES_QUERY_KEY, publicKey, network],
    queryFn: () => getStellarBalances(publicKey!),
    enabled: !!publicKey,
    staleTime: STELLAR_BALANCE_POLL_MS,
    refetchInterval: publicKey && isVisible ? STELLAR_BALANCE_POLL_MS : false,
    refetchIntervalInBackground: false,
    retry: 1,
  });

  return { balances: data ?? null, isLoading, error: error ?? null };
}
