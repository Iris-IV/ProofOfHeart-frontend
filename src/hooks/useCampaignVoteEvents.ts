'use client';

import { useEffect, useRef } from 'react';
import { fetchVoteCastEvents, isEventStreamingAvailable, parseVoteCastApprove } from '@/lib/sorobanEvents';
import { useWindowVisibility } from './useWindowVisibility';

const EVENT_POLL_INTERVAL =
  Number(process.env.NEXT_PUBLIC_VOTE_EVENTS_POLL_MS) || 5_000;

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
 * Polls Soroban `campaign_vote_cast` events and reports new votes (deduped by event id).
 */
export function useCampaignVoteEvents({
  campaignId,
  enabled = true,
  onVoteCast,
  onStreamingUnavailable,
}: UseCampaignVoteEventsOptions): { streamingAvailable: boolean } {
  const isVisible = useWindowVisibility();
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const cursorRef = useRef<string | undefined>(undefined);
  const onVoteCastRef = useRef(onVoteCast);
  const streamingAvailable = isEventStreamingAvailable();

  useEffect(() => {
    onVoteCastRef.current = onVoteCast;
  }, [onVoteCast]);

  useEffect(() => {
    seenEventIdsRef.current = new Set();
    cursorRef.current = undefined;
  }, [campaignId]);

  useEffect(() => {
    if (!enabled || !campaignId) return;

    if (!streamingAvailable) {
      onStreamingUnavailable?.();
      return;
    }

    if (!isVisible) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const result = await fetchVoteCastEvents({
          campaignId,
          cursor: cursorRef.current,
        });
        if (!result || cancelled) return;

        cursorRef.current = result.cursor;

        for (const event of result.events) {
          if (seenEventIdsRef.current.has(event.id)) continue;
          seenEventIdsRef.current.add(event.id);
          onVoteCastRef.current?.({ approve: parseVoteCastApprove(event) });
        }
      } catch {
        onStreamingUnavailable?.();
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
  }, [campaignId, enabled, isVisible, streamingAvailable, onStreamingUnavailable]);

  return { streamingAvailable };
}
