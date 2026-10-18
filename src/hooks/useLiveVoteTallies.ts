"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getApproveVotes, getRejectVotes } from "@/lib/contractClient";
import { useCampaignVoteEvents } from "./useCampaignVoteEvents";
import { useWindowVisibility } from "./useWindowVisibility";

export interface VoteTallies {
  upvotes: number;
  downvotes: number;
  totalVotes: number;
}

export interface UseLiveVoteTalliesOptions {
  campaignId: number;
  enabled?: boolean;
}

const POLL_FALLBACK_INTERVAL = Number(process.env.NEXT_PUBLIC_VOTE_TALLIES_POLL_MS) || 30_000;

async function fetchOnChainTallies(campaignId: number): Promise<VoteTallies> {
  const [approves, rejects] = await Promise.all([
    getApproveVotes(campaignId),
    getRejectVotes(campaignId),
  ]);
  return { upvotes: approves, downvotes: rejects, totalVotes: approves + rejects };
}

/**
 * Live approve/reject tallies from `campaign_vote_cast` events with polling fallback.
 */
export function useLiveVoteTallies({ campaignId, enabled = true }: UseLiveVoteTalliesOptions) {
  const isVisible = useWindowVisibility();
  const [voteCounts, setVoteCounts] = useState<VoteTallies>({
    upvotes: 0,
    downvotes: 0,
    totalVotes: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const usePollingFallbackRef = useRef(false);

  const reconcile = useCallback(async () => {
    if (!enabled || !campaignId) return;
    try {
      const tallies = await fetchOnChainTallies(campaignId);
      setVoteCounts(tallies);
    } catch {
      // Keep last known tallies on RPC errors.
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, enabled]);

  useEffect(() => {
    if (!enabled || !campaignId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    void reconcile();
  }, [campaignId, enabled, reconcile]);

  const handleVoteCast = useCallback(({ approve }: { approve: boolean }) => {
    setVoteCounts((current) => ({
      upvotes: current.upvotes + (approve ? 1 : 0),
      downvotes: current.downvotes + (approve ? 0 : 1),
      totalVotes: current.totalVotes + 1,
    }));
  }, []);

  const { streamingAvailable } = useCampaignVoteEvents({
    campaignId,
    enabled,
    onVoteCast: handleVoteCast,
    onStreamingUnavailable: () => {
      usePollingFallbackRef.current = true;
    },
  });

  useEffect(() => {
    usePollingFallbackRef.current = !streamingAvailable;
  }, [streamingAvailable]);

  useEffect(() => {
    if (!enabled || !campaignId || !isVisible) return;
    if (!usePollingFallbackRef.current && streamingAvailable) return;

    const intervalId = window.setInterval(() => {
      void reconcile();
    }, POLL_FALLBACK_INTERVAL);

    return () => window.clearInterval(intervalId);
  }, [campaignId, enabled, isVisible, reconcile, streamingAvailable]);

  const applyOptimisticVote = useCallback((voteType: "upvote" | "downvote") => {
    setVoteCounts((current) => ({
      upvotes: current.upvotes + (voteType === "upvote" ? 1 : 0),
      downvotes: current.downvotes + (voteType === "downvote" ? 1 : 0),
      totalVotes: current.totalVotes + 1,
    }));
  }, []);

  return {
    voteCounts,
    isLoading,
    reconcile,
    applyOptimisticVote,
    streamingAvailable,
  };
}
