"use client";

import { useQuery } from "@tanstack/react-query";
import { getPlatformStatus, type PlatformStatus } from "../lib/contractClient";

/**
 * Poll contract administration flags. Failed or pending reads disable writes:
 * an unverified state must never send the user to a doomed signature prompt.
 * React Query deduplicates polling across Navbar and action components.
 */
export function usePlatformStatus() {
  const query = useQuery<PlatformStatus, Error>({
    queryKey: ["platformStatus"],
    queryFn: () => getPlatformStatus(true),
    staleTime: 5_000,
    refetchInterval: 12_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const statusKnown = query.data !== undefined && !query.isError;
  const isPaused = query.data?.isPaused ?? false;
  const isCreationDisabled = query.data?.isCreationDisabled ?? false;
  return {
    isPaused,
    isCreationDisabled,
    isLoading: query.isPending,
    isError: query.isError,
    isWriteDisabled: !statusKnown || isPaused,
    isCreationBlocked: !statusKnown || isPaused || isCreationDisabled,
    refetch: query.refetch,
  };
}
