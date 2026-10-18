"use client";

import { useEffect, useRef, useState } from "react";
import {
  decodeContractEvent,
  subscribeContributionMadeEvents,
  sumContributionAmounts,
} from "../lib/sorobanEvents";
import {
  mergeContributionFeed,
  type ContributionFeedEvent,
  type ContributionFeedStatus,
} from "@/lib/contributionFeed";
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

export interface CampaignContributionStream {
  events: ContributionFeedEvent[];
  status: ContributionFeedStatus;
}

/**
 * Streams Soroban `contribution_made` events for a campaign and reports new amounts.
 * Deduplicates by event id so reconnects do not double-count.
 */
export function useCampaignContributionEvents({
  campaignId,
  enabled = true,
  onContributions,
}: UseCampaignContributionEventsOptions): CampaignContributionStream {
  const { isVisible } = useWindowVisibility();
  const [feed, setFeed] = useState<CampaignContributionStream & { campaignId: number }>({
    campaignId,
    events: [],
    status: "connecting",
  });
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

    let active = true;
    setFeed((current) => ({
      campaignId,
      events: current.campaignId === campaignId ? current.events : [],
      status: "connecting",
    }));
    const subscription = subscribeContributionMadeEvents({
      campaignId,
      onEvents: (result) => {
        if (!active) return;
        const unseen = result.events.filter((event) => {
          if (seenEventIdsRef.current.has(event.id)) return false;
          seenEventIdsRef.current.add(event.id);
          return true;
        });

        const donations: ContributionFeedEvent[] = [];
        for (const event of unseen) {
          try {
            const decoded = decodeContractEvent(event);
            if (decoded?.type === "contribution_made" && decoded.campaignId === campaignId) {
              donations.push({
                id: event.id,
                contributor: decoded.contributor,
                amount: decoded.amount,
                ledgerClosedAt: event.ledgerClosedAt,
              });
            }
          } catch {
            // A malformed payload must not interrupt subsequent donations.
          }
        }
        setFeed((current) => {
          if (current.campaignId === campaignId && current.status === "live" && donations.length === 0) {
            return current;
          }
          return {
            campaignId,
            events: mergeContributionFeed(
              current.campaignId === campaignId ? current.events : [],
              donations,
            ),
            status: "live",
          };
        });

        if (unseen.length > 0) {
          const delta = sumContributionAmounts(unseen);
          onContributionsRef.current?.(delta, unseen.length);
          invalidateQueriesForEvents(queryClient, unseen, currentWalletAddress);
        }
      },
      onError: () => {
        if (!active) return;
        setFeed((current) => ({ ...current, status: "reconnecting" }));
        // RPC errors are non-fatal; reconciliation via get_campaign covers drift.
      },
    });

    if (!subscription) {
      setFeed((current) => ({ ...current, status: "unavailable" }));
    }

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [campaignId, enabled, isVisible, queryClient, currentWalletAddress]);

  return {
    events: feed.campaignId === campaignId ? feed.events : [],
    status: USE_MOCKS ? "mock" : !enabled || !campaignId || !isVisible ? "paused" : feed.status,
  };
}
