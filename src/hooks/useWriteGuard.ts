"use client";

import { useCallback, useRef } from "react";

/**
 * Returns an `invoke` wrapper that prevents concurrent calls for the same
 * (action, campaignId) key.  A second click while a transaction is in-flight
 * is silently dropped — the first call still resolves/rejects normally.
 *
 * Usage:
 *   const { invoke, isPending } = useWriteGuard();
 *   <button disabled={isPending("contribute", id)} onClick={() => invoke("contribute", id, () => contribute(id, ...))} />
 */
export function useWriteGuard() {
  const inFlight = useRef(new Set<string>());

  const isPending = useCallback((action: string, campaignId?: number): boolean => {
    return inFlight.current.has(`${action}:${campaignId ?? "_"}`);
  }, []);

  const invoke = useCallback(
    async <T>(
      action: string,
      campaignId: number | undefined,
      fn: () => Promise<T>,
    ): Promise<T | null> => {
      const key = `${action}:${campaignId ?? "_"}`;
      if (inFlight.current.has(key)) return null;
      inFlight.current.add(key);
      try {
        return await fn();
      } finally {
        inFlight.current.delete(key);
      }
    },
    [],
  );

  return { invoke, isPending };
}
