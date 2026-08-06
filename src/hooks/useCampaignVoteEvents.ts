"use client";

import { useEffect } from "react";
import {
  fetchVoteCastEvents,
  isEventStreamingAvailable,
  parseVoteCastApprove,
} from "@/lib/sorobanEvents";
import { useCampaignEvents } from "./useCampaignEvents";

const EVENT_POLL_INTERVAL = Number(process.env.NEXT_PUBLIC_VOTE_EVENTS_POLL_MS) || 5_000;

export interface VoteCastDelta {
  approve: boolean;
}

export interface UseCampaignVoteEventsOptions {
  campaignId: number;
  enabled?: boolean;
  onVoteCast?: (vote: VoteCastDelta) => void;
  onStreamingUnavailable?: () => void;
}

export function useCampaignVoteEvents({
  campaignId,
  enabled = true,
  onVoteCast,
  onStreamingUnavailable,
}: UseCampaignVoteEventsOptions): { streamingAvailable: boolean } {
  const streamingAvailable = isEventStreamingAvailable();

  useEffect(() => {
    if (!enabled || !campaignId) return;
    if (!streamingAvailable) {
      onStreamingUnavailable?.();
    }
  }, [campaignId, enabled, streamingAvailable, onStreamingUnavailable]);

  useCampaignEvents({
    campaignId,
    enabled: enabled && streamingAvailable,
    fetchEvents: fetchVoteCastEvents,
    onUnseenEvents: (unseen) => {
      for (const event of unseen) {
        onVoteCast?.({ approve: parseVoteCastApprove(event) });
      }
    },
    pollIntervalMs: EVENT_POLL_INTERVAL,
    onError: () => {
      onStreamingUnavailable?.();
    },
  });

  return { streamingAvailable };
}
