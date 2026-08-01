"use client";

import { useEffect, useRef } from "react";
import { isContributionMadeEvent, parseContributionAmount } from "../lib/sorobanEvents";
import { useWindowVisibility } from "./useWindowVisibility";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/components/WalletContext";
import { invalidateQueriesForEvents } from "@/lib/cacheInvalidation";
import { eventSubscriber } from "../lib/eventSubscriber";
import * as StellarSdk from "@stellar/stellar-sdk";

const USE_MOCKS = typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_MOCKS === "true";

export interface UseCampaignContributionEventsOptions {
  campaignId: number;
  enabled?: boolean;
  onContributions?: (totalAmount: bigint, eventCount: number) => void;
}

/**
 * Listens to Soroban `contribution_made` events for a campaign and reports new amounts.
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

    eventSubscriber.start();

    const handler = (event: StellarSdk.rpc.Api.EventResponse) => {
      if (isContributionMadeEvent(event, campaignId)) {
        if (!seenEventIdsRef.current.has(event.id)) {
          seenEventIdsRef.current.add(event.id);
          const delta = parseContributionAmount(event);
          onContributionsRef.current?.(delta, 1);
          invalidateQueriesForEvents(queryClient, [event], currentWalletAddress);
        }
      }
    };

    eventSubscriber.on("contribution_made", handler);

    return () => {
      eventSubscriber.off("contribution_made", handler);
    };
  }, [campaignId, enabled, isVisible, queryClient, currentWalletAddress]);
}
