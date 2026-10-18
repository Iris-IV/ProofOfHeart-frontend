/**
 * Generic typed localStorage store helper.
 *
 * Provides a single point of change for localStorage access patterns,
 * making future backend migration easier by consolidating the read/write
 * boilerplate with JSON parse error handling.
 */

/**
 * Checks if localStorage is available in the current environment.
 */
export function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/**
 * Reads a value from localStorage and parses it as JSON.
 * Returns null if the key doesn't exist, parsing fails, or storage is unavailable.
 */
export function getItem<T>(key: string): T | null {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Writes a value to localStorage as JSON.
 * Silently ignores failures (e.g., quota exceeded, storage disabled).
 */
export function setItem<T>(key: string, value: T): void {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore localStorage write failures.
  }
}

/**
 * Reads an array from localStorage.
 * Returns an empty array if the key doesn't exist, parsing fails, or storage is unavailable.
 */
export function getArray<T>(key: string): T[] {
  const value = getItem<T[]>(key);
  if (!Array.isArray(value)) return [];
  return value;
}

/**
 * Writes an array to localStorage with optional max entries limit.
 * If maxEntries is provided, only the last N entries are kept.
 * Silently ignores failures.
 */
export function setArray<T>(key: string, value: T[], maxEntries?: number): void {
  const toStore = maxEntries !== undefined ? value.slice(-maxEntries) : value;
  setItem(key, toStore);
}

/**
 * Reads a raw string value from localStorage without JSON parsing.
 * Use this for keys written as plain strings (e.g. theme, locale) to
 * preserve backward compatibility with values not stored as JSON.
 * Returns null if the key doesn't exist or storage is unavailable.
 */
export function getRawItem(key: string): string | null {
  if (!canUseStorage()) return null;

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Writes a raw string value to localStorage without JSON serialisation.
 * Use this for keys that must remain as plain strings (e.g. theme, locale)
 * so that the inline FOUC script and LanguageSwitcher can read them directly.
 * Silently ignores failures.
 */
export function setRawItem(key: string, value: string): void {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore localStorage write failures.
  }
}

/**
 * Removes a value from localStorage.
 * Silently ignores failures.
 */
export function removeItem(key: string): void {
  if (!canUseStorage()) return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore localStorage removal failures.
  }
}
