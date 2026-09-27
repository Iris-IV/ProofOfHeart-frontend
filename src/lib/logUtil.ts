/**
 * Consolidated logging utility module for ProofOfHeart frontend.
 *
 * Provides a clean, reusable interface for managing structured log entries
 * with localStorage persistence, timestamp management, and filtering capabilities.
 *
 * Used by:
 * - adminLog.ts: Admin audit trail
 * - transactionLog.ts: Wallet transaction history
 *
 * @module logUtil
 */

import { getArray, setArray, canUseStorage } from "./localStorageStore";
import { normalizeAddress } from "./stellar";

// Re-export storage availability check for consumers
export { canUseStorage };

/**
 * Reads all log entries from localStorage for a given storage key.
 *
 * @template T - The log entry type
 * @param storageKey - The localStorage key
 * @returns Array of log entries, or empty array if unavailable
 */
export function readAllEntries<T>(storageKey: string): T[] {
  return getArray<T>(storageKey);
}

/**
 * Writes log entries to localStorage with optional size limit.
 *
 * @template T - The log entry type
 * @param storageKey - The localStorage key
 * @param entries - The log entries to persist
 * @param maxEntries - Optional maximum number of entries to keep (FIFO)
 */
export function writeAllEntries<T>(storageKey: string, entries: T[], maxEntries?: number): void {
  setArray(storageKey, entries, maxEntries);
}

/**
 * Appends a current timestamp to a log entry.
 *
 * @template T - The log entry type (must include timestamp field)
 * @param entry - Log entry without timestamp or with optional timestamp
 * @returns Entry with timestamp set to current time
 */
export function appendTimestamp<T extends object>(
  entry: Omit<T, "timestamp"> & { timestamp?: number },
): T {
  return { ...entry, timestamp: Date.now() } as T;
}

/**
 * Filters log entries by normalized address and sorts by timestamp descending.
 *
 * This is the primary query interface for retrieving address-specific logs.
 *
 * @template T - The log entry type (must have timestamp field)
 * @param entries - All log entries
 * @param addressField - The field name containing the address to filter by
 * @param address - The Stellar address to filter for (will be normalized)
 * @param limit - Optional maximum number of entries to return
 * @returns Filtered and sorted log entries (most recent first)
 */
export function filterAndSortByTimestamp<T extends { timestamp: number }>(
  entries: T[],
  addressField: keyof T,
  address: string,
  limit?: number,
): T[] {
  const normalized = normalizeAddress(address);
  const filtered = entries.filter(
    (entry) => normalizeAddress(entry[addressField] as string) === normalized,
  );
  const sorted = filtered.sort((a, b) => b.timestamp - a.timestamp);
  return limit != null ? sorted.slice(0, Math.max(0, limit)) : sorted;
}
