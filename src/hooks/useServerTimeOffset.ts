"use client";

import { useEffect, useState } from "react";
import { getServerTimeOffsetMs } from "../lib/serverTime";

/**
 * Measures `serverTime - clientTime` once on mount so countdown UIs can ignore
 * a wrong local system clock (#1212). Stays `null` until a measurement lands,
 * and stays `null` permanently if the server cannot be reached.
 */
export function useServerTimeOffset(): number | null {
  const [offsetMs, setOffsetMs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    getServerTimeOffsetMs().then((offset) => {
      if (!cancelled) setOffsetMs(offset);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return offsetMs;
}
