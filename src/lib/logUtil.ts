import { getArray, setArray, canUseStorage } from "./localStorageStore";
import { normalizeAddress } from "./stellar";

export { canUseStorage };

export function readAllEntries<T>(storageKey: string): T[] {
  return getArray<T>(storageKey);
}

export function writeAllEntries<T>(storageKey: string, entries: T[], maxEntries?: number): void {
  setArray(storageKey, entries, maxEntries);
}

export function appendTimestamp<T extends object>(
  entry: Omit<T, "timestamp"> & { timestamp?: number },
): T {
  return { ...entry, timestamp: Date.now() } as T;
}

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
