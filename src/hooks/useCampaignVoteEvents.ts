"use client";

import { useEffect, useRef } from "react";
import {
  isEventStreamingAvailable,
  isVoteCastEvent,
  parseVoteCastApprove,
} from "@/lib/sorobanEvents";
import { useWindowVisibility } from "./useWindowVisibility";
import { eventSubscriber } from "../lib/eventSubscriber";
import * as StellarSdk from "@stellar/stellar-sdk";

export interface VoteCastDelta {
  approve: boolean;
}

export interface UseCampaignVoteEventsOptions {
  campaignId: number;
  enabled?: boolean;
  onVoteCast?: (vote: VoteCastDelta) => void;
  onStreamingUnavailable?: () => void;
}

/**
 * Listens to Soroban `campaign_vote_cast` events and reports new votes (deduped by event id).
 */
export function useCampaignVoteEvents({
  campaignId,
  enabled = true,
  onVoteCast,
  onStreamingUnavailable,
}: UseCampaignVoteEventsOptions): { streamingAvailable: boolean } {
  const isVisible = useWindowVisibility();
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const onVoteCastRef = useRef(onVoteCast);
  const streamingAvailable = isEventStreamingAvailable();

  useEffect(() => {
    onVoteCastRef.current = onVoteCast;
  }, [onVoteCast]);

  useEffect(() => {
    seenEventIdsRef.current = new Set();
  }, [campaignId]);

  useEffect(() => {
    if (!enabled || !campaignId) return;

    if (!streamingAvailable) {
      onStreamingUnavailable?.();
      return;
    }

    if (!isVisible) return;

    eventSubscriber.start();

    const handler = (event: StellarSdk.rpc.Api.EventResponse) => {
      if (isVoteCastEvent(event, campaignId)) {
        if (!seenEventIdsRef.current.has(event.id)) {
          seenEventIdsRef.current.add(event.id);
          onVoteCastRef.current?.({ approve: parseVoteCastApprove(event) });
        }
      }
    };

    eventSubscriber.on("campaign_vote_cast", handler);

    return () => {
      eventSubscriber.off("campaign_vote_cast", handler);
    };
  }, [campaignId, enabled, isVisible, streamingAvailable, onStreamingUnavailable]);

  return { streamingAvailable };
}
