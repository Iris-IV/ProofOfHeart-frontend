"use client";

import { useEffect, useState } from "react";
import { useServerTimeOffset } from "./useServerTimeOffset";
import { nowWithOffset } from "@/lib/serverTime";

/**
 * Provides the current time in seconds (Unix timestamp) adjusted for server/ledger time.
 * Falls back to the device clock (Date.now()) if the server offset isn't available.
 * Returns Math.floor(seconds) for contract deadline comparisons.
 */
export function useLedgerNow(): number {
  const offsetMs = useServerTimeOffset();
  const [now, setNow] = useState<number>(() =>
    Math.floor(nowWithOffset(offsetMs) / 1000)
  );

  useEffect(() => {
    setNow(Math.floor(nowWithOffset(offsetMs) / 1000));
  }, [offsetMs]);

  return now;
}
