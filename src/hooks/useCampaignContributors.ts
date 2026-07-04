"use client";

import { useState, useEffect } from "react";
import {
  fetchContributionMadeEvents,
  parseContributionAmount,
  parseContributorAddress,
} from "../lib/sorobanEvents";

export interface TopContributor {
  address: string;
  totalAmount: bigint;
  eventCount: number;
}

export interface UseCampaignContributorsResult {
  topContributors: TopContributor[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCampaignContributors(
  campaignId: number,
  limit: number = 5,
): UseCampaignContributorsResult {
  const [topContributors, setTopContributors] = useState<TopContributor[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    if (!campaignId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchAllContributors = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const aggregated = new Map<string, TopContributor>();
        let cursor: string | undefined = undefined;
        let hasMore = true;

        while (hasMore && !cancelled) {
          const result = await fetchContributionMadeEvents({
            campaignId,
            cursor,
            limit: 100,
            startLedger: 1, // Start from the beginning to get all history
          });

          if (!result || result.events.length === 0) {
            hasMore = false;
            break;
          }

          for (const event of result.events) {
            const amount = parseContributionAmount(event);
            const address = parseContributorAddress(event);

            if (address && amount > BigInt(0)) {
              const existing = aggregated.get(address) || {
                address,
                totalAmount: BigInt(0),
                eventCount: 0,
              };
              existing.totalAmount += amount;
              existing.eventCount += 1;
              aggregated.set(address, existing);
            }
          }

          cursor = result.cursor;
        }

        if (!cancelled) {
          const sorted = Array.from(aggregated.values()).sort((a, b) => {
            if (a.totalAmount > b.totalAmount) return -1;
            if (a.totalAmount < b.totalAmount) return 1;
            return 0;
          });

          setTopContributors(sorted.slice(0, limit));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch contributors");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchAllContributors();

    return () => {
      cancelled = true;
    };
  }, [campaignId, limit, trigger]);

  const refetch = () => setTrigger((prev) => prev + 1);

  return {
    topContributors,
    isLoading,
    error,
    refetch,
  };
}
