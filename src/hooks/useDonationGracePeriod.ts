'use client';

import { useState, useEffect, useCallback } from 'react';

export interface PendingDonation {
  id: string;
  campaignId: string;
  campaignTitle: string;
  amount: number;
  currency: string;
  timestamp: number;
  expiresAt: number;
}

const DEFAULT_GRACE_PERIOD_MS = 60_000; // 60 seconds

// Server time sync ------------------------------------------------------------
//
// The grace-period deadline is enforced on-chain, so the countdown must be
// anchored to a server-confirmed timestamp rather than the client's local
// clock. We derive a client<->server clock offset from the app's health
// endpoint (which reports the server's own `Date.now()`), then apply that
// offset everywhere the hook reasons about "now". When the server cannot be
// reached we degrade gracefully to the client clock (offset 0).

const SERVER_TIME_URL = '/api/health';
const SYNC_TIMEOUT_MS = 4000;
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000; // beyond this, treat as invalid

/**
 * Resolves to the server-confirmed epoch (ms), or `null` when it cannot be
 * obtained (network failure, unparseable/invalid response).
 */
export async function fetchServerTimeMs(): Promise<number | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  try {
    const response = await fetch(SERVER_TIME_URL, {
      signal: controller.signal,
      cache: 'no-store',
    });
    const body: unknown = await response.json();
    const timestamp = (body as { timestamp?: unknown })?.timestamp;
    const serverMs = typeof timestamp === 'string' ? Date.parse(timestamp) : Number.NaN;
    return Number.isFinite(serverMs) ? serverMs : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

let serverTimeCache: Promise<number | null> | null = null;

/** Shared server-time request so all consumers perform a single round-trip. */
export function getServerTimeMs(): Promise<number | null> {
  serverTimeCache ??= fetchServerTimeMs();
  return serverTimeCache;
}

/** Clears the shared server-time cache (mainly for tests / re-sync). */
export function resetServerTimeCache(): void {
  serverTimeCache = null;
}

export interface ServerTimeOffset {
  /** `serverNow - clientNow` in ms. `0` until synced or when sync failed. */
  offsetMs: number;
  /** Whether the offset has been confirmed against the server. */
  isSynced: boolean;
}

/**
 * Tracks the client<->server clock offset. Falling back to `{ offsetMs: 0 }`
 * keeps the app usable when the server is unreachable.
 */
export function useServerTimeOffset(): ServerTimeOffset {
  const [state, setState] = useState<ServerTimeOffset>({ offsetMs: 0, isSynced: false });

  useEffect(() => {
    let cancelled = false;
    const clientAtRequest = Date.now();
    getServerTimeMs().then((serverMs) => {
      if (cancelled || serverMs === null) return;
      const clientAtResponse = Date.now();
      const estimatedClientNow = (clientAtRequest + clientAtResponse) / 2;
      const offsetMs = serverMs - estimatedClientNow;
      if (Math.abs(offsetMs) <= MAX_CLOCK_SKEW_MS) {
        setState({ offsetMs, isSynced: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function useDonationGracePeriod(gracePeriodMs: number = DEFAULT_GRACE_PERIOD_MS) {
  const { offsetMs } = useServerTimeOffset();
  const [pendingDonations, setPendingDonations] = useState<PendingDonation[]>([]);

  // Periodically purge expired donations using the server-adjusted clock
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now() + offsetMs;
      setPendingDonations((prev) => prev.filter((d) => d.expiresAt > now));
    }, 1000);

    return () => clearInterval(interval);
  }, [offsetMs]);

  const startGracePeriod = useCallback(
    (donation: Omit<PendingDonation, 'id' | 'timestamp' | 'expiresAt'>) => {
      const now = Date.now() + offsetMs;
      const newDonation: PendingDonation = {
        ...donation,
        id: `pending_${now}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: now,
        expiresAt: now + gracePeriodMs,
      };

      setPendingDonations((prev) => [newDonation, ...prev]);
      return newDonation;
    },
    [gracePeriodMs, offsetMs]
  );

  const cancelDonation = useCallback((id: string) => {
    let cancelled: PendingDonation | undefined;
    setPendingDonations((prev) => {
      cancelled = prev.find((d) => d.id === id);
      return prev.filter((d) => d.id !== id);
    });
    return cancelled;
  }, []);

  const finalizeDonation = useCallback((id: string) => {
    setPendingDonations((prev) => prev.filter((d) => d.id !== id));
  }, []);

  return {
    pendingDonations,
    startGracePeriod,
    cancelDonation,
    finalizeDonation,
  };
}
