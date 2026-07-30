"use client";

import { fetchContributionMadeEvents, sumContributionAmounts } from "../lib/sorobanEvents";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/components/WalletContext";
import { invalidateQueriesForEvents } from "@/lib/cacheInvalidation";
import { useCampaignEvents } from "./useCampaignEvents";

const EVENT_POLL_INTERVAL = Number(process.env.NEXT_PUBLIC_CONTRIBUTION_EVENTS_POLL_MS) || 5_000;

export interface UseCampaignContributionEventsOptions {
  campaignId: number;
  enabled?: boolean;
  onContributions?: (totalAmount: bigint, eventCount: number) => void;
}

export function useCampaignContributionEvents({
  campaignId,
  enabled = true,
  onContributions,
}: UseCampaignContributionEventsOptions): void {
  const queryClient = useQueryClient();
  const { publicKey: currentWalletAddress } = useWallet();

  useCampaignEvents({
    campaignId,
    enabled,
    fetchEvents: fetchContributionMadeEvents,
    onUnseenEvents: (unseen) => {
      const delta = sumContributionAmounts(unseen);
      onContributions?.(delta, unseen.length);
      invalidateQueriesForEvents(queryClient, unseen, currentWalletAddress);
    },
    pollIntervalMs: EVENT_POLL_INTERVAL,
    useMocksCheck: true,
  });
}
