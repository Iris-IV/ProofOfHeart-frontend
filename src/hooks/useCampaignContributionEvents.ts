"use client";

import { useEffect, useRef } from "react";
import { fetchContributionMadeEvents, sumContributionAmounts } from "../lib/sorobanEvents";
import { useWindowVisibility } from "./useWindowVisibility";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/components/WalletContext";
import { invalidateQueriesForEvents } from "@/lib/cacheInvalidation";

const EVENT_POLL_INTERVAL = Number(process.env.NEXT_PUBLIC_CONTRIBUTION_EVENTS_POLL_MS) || 5_000;

const USE_MOCKS = typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_MOCKS === "true";

export interface UseCampaignContributionEventsOptions {
  campaignId: number;
  enabled?: boolean;
  onContributions?: (totalAmount: bigint, eventCount: number) => void;
}

/**
 * Polls Soroban `contribution_made` events for a campaign and reports new amounts.
 * Deduplicates by event id so reconnects do not double-count.
 */
export function useCampaignContributionEvents({
  campaignId,
  enabled = true,
  onContributions,
}: UseCampaignContributionEventsOptions): void {
  const isVisible = useWindowVisibility();
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const cursorRef = useRef<string | undefined>(undefined);
  const onContributionsRef = useRef(onContributions);
  const queryClient = useQueryClient();
  const { publicKey: currentWalletAddress } = useWallet();

  useEffect(() => {
    onContributionsRef.current = onContributions;
  }, [onContributions]);

  useEffect(() => {
    seenEventIdsRef.current = new Set();
    cursorRef.current = undefined;
  }, [campaignId]);

  useEffect(() => {
    if (!enabled || !campaignId || USE_MOCKS || !isVisible) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const result = await fetchContributionMadeEvents({
          campaignId,
          cursor: cursorRef.current,
        });
        if (!result || cancelled) return;

        cursorRef.current = result.cursor;

        const unseen = result.events.filter((event) => !seenEventIdsRef.current.has(event.id));
        for (const event of unseen) {
          seenEventIdsRef.current.add(event.id);
        }

        if (unseen.length > 0) {
          const delta = sumContributionAmounts(unseen);
          onContributionsRef.current?.(delta, unseen.length);

          // Invalidate relevant queries for the new events
          invalidateQueriesForEvents(queryClient, unseen, currentWalletAddress);
        }
      } catch {
        // RPC errors are non-fatal; reconciliation via get_campaign covers drift.
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, EVENT_POLL_INTERVAL);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [campaignId, enabled, isVisible]);
}
