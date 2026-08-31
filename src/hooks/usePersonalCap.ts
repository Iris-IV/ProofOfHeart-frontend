"use client";

import { useQuery } from "@tanstack/react-query";
import { getPersonalCap } from "../lib/contractClient";

export function usePersonalCap(campaignId: number | string, userAddress: string | null) {
  const id = typeof campaignId === "string" ? parseInt(campaignId, 10) : campaignId;

  const { data, isLoading, refetch } = useQuery<bigint, Error>({
    queryKey: ["personalCap", id, userAddress],
    queryFn: () => getPersonalCap(id, userAddress!),
    enabled: !!userAddress && Number.isFinite(id),
    staleTime: 30_000,
  });

  return {
    personalCap: data ?? BigInt(0),
    isLoading,
    refetch,
  };
}
