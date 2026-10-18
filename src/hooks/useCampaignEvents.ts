"use client";

import { useEffect, useRef } from "react";
import { useWindowVisibility } from "./useWindowVisibility";

const USE_MOCKS = typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_MOCKS === "true";

export interface CampaignEvent {
  id: string;
}

export interface UseCampaignEventsOptions<TEvent extends CampaignEvent> {
  campaignId: number;
  enabled?: boolean;
  fetchEvents: (params: {
    campaignId: number;
    cursor?: string;
  }) => Promise<{ events: TEvent[]; cursor?: string } | null | undefined>;
  onUnseenEvents: (unseenEvents: TEvent[]) => void;
  pollIntervalMs: number;
  useMocksCheck?: boolean;
  onError?: (error: unknown) => void;
}

export function useCampaignEvents<TEvent extends CampaignEvent>({
  campaignId,
  enabled = true,
  fetchEvents,
  onUnseenEvents,
  pollIntervalMs,
  useMocksCheck = false,
  onError,
}: UseCampaignEventsOptions<TEvent>): void {
  const isVisible = useWindowVisibility();
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const cursorRef = useRef<string | undefined>(undefined);
  const onUnseenEventsRef = useRef(onUnseenEvents);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onUnseenEventsRef.current = onUnseenEvents;
  }, [onUnseenEvents]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    seenEventIdsRef.current = new Set();
    cursorRef.current = undefined;
  }, [campaignId]);

  useEffect(() => {
    if (!enabled || !campaignId || (useMocksCheck && USE_MOCKS) || !isVisible) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const result = await fetchEvents({
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
          onUnseenEventsRef.current(unseen);
        }
      } catch (error) {
        onErrorRef.current?.(error);
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [campaignId, enabled, isVisible]);
}
