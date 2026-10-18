"use client";

import { useEffect, useRef } from "react";
import { subscribeContributionMadeEvents, sumContributionAmounts } from "../lib/sorobanEvents";
import { useWindowVisibility } from "./useWindowVisibility";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/components/WalletContext";
import { invalidateQueriesForEvents } from "@/lib/cacheInvalidation";

const USE_MOCKS = typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_MOCKS === "true";

export interface UseCampaignContributionEventsOptions {
  campaignId: number;
  enabled?: boolean;
  onContributions?: (totalAmount: bigint, eventCount: number) => void;
}

/**
 * Streams Soroban `contribution_made` events for a campaign and reports new amounts.
 * Deduplicates by event id so reconnects do not double-count.
 */
export function useCampaignContributionEvents({
  campaignId,
  enabled = true,
  onContributions,
}: UseCampaignContributionEventsOptions): void {
  const isVisible = useWindowVisibility();
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const onContributionsRef = useRef(onContributions);
  const queryClient = useQueryClient();
  const { publicKey: currentWalletAddress } = useWallet();

  useEffect(() => {
    onContributionsRef.current = onContributions;
  }, [onContributions]);

  useEffect(() => {
    seenEventIdsRef.current = new Set();
  }, [campaignId]);

  useEffect(() => {
    if (!enabled || !campaignId || USE_MOCKS || !isVisible) {
      return;
    }

    const subscription = subscribeContributionMadeEvents({
      campaignId,
      onEvents: (result) => {
        const unseen = result.events.filter((event) => !seenEventIdsRef.current.has(event.id));
        for (const event of unseen) {
          seenEventIdsRef.current.add(event.id);
        }

        if (unseen.length > 0) {
          const delta = sumContributionAmounts(unseen);
          onContributionsRef.current?.(delta, unseen.length);
          invalidateQueriesForEvents(queryClient, unseen, currentWalletAddress);
        }
      },
      onError: () => {
        // RPC errors are non-fatal; reconciliation via get_campaign covers drift.
      },
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [campaignId, enabled, isVisible, queryClient, currentWalletAddress]);
}
