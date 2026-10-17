"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  contribute as submitContribution,
  getContribution,
  type TransactionLifecycleOptions,
} from "../lib/contractClient";
import type { Campaign } from "../types";

export interface ContributeInput {
  /** Amount in stroops. */
  amount: bigint;
  options?: TransactionLifecycleOptions;
}

interface OptimisticSnapshot {
  previousContribution: bigint | undefined;
  previousCampaigns: Campaign[] | undefined;
}

/**
 * Reads the connected wallet's contribution to a campaign and exposes
 * `contribute`, which updates the UI optimistically: the user's total and the
 * campaign's `amount_raised` in the shared ["campaigns"] list grow as soon as
 * the transaction is sent. If the transaction fails, both are rolled back and
 * `contributionError` holds the contract error translation key. Once it
 * settles either way, both queries are refetched so the UI matches the ledger.
 */
export function useContribution(campaignId: number | string, userAddress: string | null) {
  const id = typeof campaignId === "string" ? parseInt(campaignId, 10) : campaignId;
  const queryClient = useQueryClient();
  const contributionKey = useMemo(
    () => ["contribution", id, userAddress] as const,
    [id, userAddress],
  );

  const { data, isLoading } = useQuery<bigint, Error>({
    queryKey: contributionKey,
    queryFn: () => getContribution(id, userAddress!),
    enabled: !!userAddress && Number.isFinite(id),
    staleTime: 30_000,
  });

  const mutation = useMutation<string, Error, ContributeInput, OptimisticSnapshot>({
    mutationFn: ({ amount, options }) => {
      if (!userAddress) throw new Error("Connect a wallet to contribute.");
      return submitContribution(id, userAddress, amount, options);
    },
    onMutate: async ({ amount }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: contributionKey }),
        queryClient.cancelQueries({ queryKey: ["campaigns"], exact: true }),
      ]);

      const previousContribution = queryClient.getQueryData<bigint>(contributionKey);
      const previousCampaigns = queryClient.getQueryData<Campaign[]>(["campaigns"]);

      queryClient.setQueryData<bigint>(
        contributionKey,
        (previousContribution ?? BigInt(0)) + amount,
      );
      if (previousCampaigns) {
        queryClient.setQueryData<Campaign[]>(
          ["campaigns"],
          previousCampaigns.map((campaign) =>
            campaign.id === id
              ? { ...campaign, amount_raised: campaign.amount_raised + amount }
              : campaign,
          ),
        );
      }

      return { previousContribution, previousCampaigns };
    },
    onError: (_error, _input, snapshot) => {
      if (!snapshot) return;
      if (snapshot.previousContribution === undefined) {
        queryClient.removeQueries({ queryKey: contributionKey, exact: true });
      } else {
        queryClient.setQueryData(contributionKey, snapshot.previousContribution);
      }
      if (snapshot.previousCampaigns) {
        queryClient.setQueryData(["campaigns"], snapshot.previousCampaigns);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: contributionKey });
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });

  const { mutateAsync, isPending, error, reset } = mutation;

  return useMemo(
    () => ({
      contribution: data ?? BigInt(0),
      isLoading,
      /** Sends the contribution; resolves with the transaction hash. */
      contribute: mutateAsync,
      /** True from submission until the transaction confirms or fails. */
      isContributing: isPending,
      contributionError: error?.message ?? null,
      resetContributionError: reset,
    }),
    [data, isLoading, mutateAsync, isPending, error, reset],
  );
}
