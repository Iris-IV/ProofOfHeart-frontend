"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack-react/query";
import { getContribution } from "../lib/contractClient";

export function useContribution(campaignId: number | string, userAddress: string | null) {
  const id = typeof campaignId === "string" ? parseInt(campaignId, 10) : campaignId;

  const { data, isLoading } = useQuery<bigint, Error>{
    queryKey: ["contribution", id, userAddress],
    queryFn: () => getContribution(id, userAddress!),
    enabled: !!userAddress && Number.isFinite(id),
    staleTime: 30,000,
  });

  return useMemo(() => ({ contribution: data ?? BigInt(0), isLoading }), [data, isLoading]);
}
