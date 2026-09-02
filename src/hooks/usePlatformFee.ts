"use client";

import { useQuery } from "@tanstack/react-query";
import { getPlatformFee } from "../lib/contractClient";

export const DEFAULT_PLATFORM_FEE_BPS = 300;
export const PLATFORM_FEE_QUERY_KEY = ["platformFee"] as const;

interface UsePlatformFeeResult {
  platformFeeBps: number;
  isLoading: boolean;
  isFallback: boolean;
}

export function usePlatformFee(): UsePlatformFeeResult {
  const { data, isLoading, isError } = useQuery<number, Error>({
    queryKey: PLATFORM_FEE_QUERY_KEY,
    queryFn: getPlatformFee,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    retry: 1,
  });

  return {
    platformFeeBps: data ?? DEFAULT_PLATFORM_FEE_BPS,
    isLoading,
    isFallback: isError || data === undefined,
  };
}
