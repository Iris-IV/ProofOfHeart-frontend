import { useEffect, useRef } from "react";

// Single shared 60-second timer for all DeadlineCountdown instances.
// Prevents N×setInterval when many countdown cards are mounted simultaneously.

export type Unsubscribe = () => void;

export interface UseCountdownTickOptions {
  /** Whether the subscription is active. Defaults to true. */
  enabled?: boolean;
  /** Schedule the callback inside requestAnimationFrame and cancel on unmount. */
  useAnimationFrame?: boolean;
}

const TICK_INTERVAL_MS = 60_000;

const subscribers = new Set<() => void>();
let timerId: ReturnType<typeof setInterval> | null = null;
let pendingRafId: number | null = null;

function stopSharedTimer(): void {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
  if (
    pendingRafId !== null &&
    typeof cancelAnimationFrame === "function"
  ) {
    cancelAnimationFrame(pendingRafId);
    pendingRafId = null;
  }
}

function tick(): void {
  if (subscribers.size === 0) {
    stopSharedTimer();
    return;
  }
  const snapshot = Array.from(subscribers);
  for (const cb of snapshot) {
    if (!subscribers.has(cb)) continue;
    try {
      cb();
    } catch {
      // Isolate subscriber errors so remaining countdowns continue updating.
    }
  }
}

export function subscribeToCountdownTick(callback: () => void): Unsubscribe {
  subscribers.add(callback);
  if (timerId === null) {
    timerId = setInterval(tick, TICK_INTERVAL_MS);
  }

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    subscribers.delete(callback);
    if (subscribers.size === 0) {
      stopSharedTimer();
    }
  };
}

/**
 * React hook that subscribes to the shared 60-second countdown tick and
 * guarantees cleanup of both `setInterval` and `requestAnimationFrame`
 * handles when the component unmounts or is disabled.
 */
export function useCountdownTick(
  onTick: () => void,
  options: UseCountdownTickOptions = {}
): void {
  const { enabled = true, useAnimationFrame = false } = options;
  const callbackRef = useRef(onTick);
  callbackRef.current = onTick;

  useEffect(() => {
    if (!enabled) return;

    let rafHandle: number | null = null;

    const unsubscribe = subscribeToCountdownTick(() => {
      if (
        useAnimationFrame &&
        typeof requestAnimationFrame === "function"
      ) {
        if (rafHandle !== null && typeof cancelAnimationFrame === "function") {
          cancelAnimationFrame(rafHandle);
        }
        rafHandle = requestAnimationFrame(() => {
          rafHandle = null;
          callbackRef.current();
        });
      } else {
        callbackRef.current();
      }
    });

    return () => {
      unsubscribe();
      if (rafHandle !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(rafHandle);
        rafHandle = null;
      }
    };
  }, [enabled, useAnimationFrame]);
}

/** Returns the current number of active subscribers (for diagnostics/tests). */
export function getCountdownSubscriberCount(): number {
  return subscribers.size;
}

/** Clears all subscribers and active timer/rAF handles. */
export function resetCountdownTick(): void {
  subscribers.clear();
  stopSharedTimer();
}
