export function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readAllEntries<T>(storageKey: string): T[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as T[];
  } catch {
    return [];
  }
}

export function writeAllEntries<T>(storageKey: string, entries: T[]): void {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(entries));
  } catch {
    // Ignore localStorage write failures.
  }
}
