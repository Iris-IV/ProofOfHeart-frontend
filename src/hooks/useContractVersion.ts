"use client";

import { useQuery } from "@tanstack/react-query";
import { getVersion, EXPECTED_CONTRACT_VERSION } from "../lib/contractClient";

export interface UseContractVersionResult {
  version: number | null;
  expectedVersion: number;
  isMismatch: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useContractVersion(): UseContractVersionResult {
  const { data, isLoading, error } = useQuery<number, Error>({
    queryKey: ["contractVersion"],
    queryFn: () => getVersion(),
    staleTime: Infinity, // Version rarely changes
    retry: 2,
  });

  const version = data ?? null;
  const isMismatch = version !== null && version !== EXPECTED_CONTRACT_VERSION;

  return {
    version,
    expectedVersion: EXPECTED_CONTRACT_VERSION,
    isMismatch,
    isLoading,
    error: error?.message ?? null,
  };
}
