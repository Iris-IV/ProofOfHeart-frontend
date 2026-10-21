/**
 * Layout the explore listing renders campaigns in.
 *
 * - `compact`: one dense row per campaign (the original layout).
 * - `grid`: detailed cards in a responsive grid.
 */
export type ExploreDensity = "compact" | "grid";

export const EXPLORE_DENSITY_STORAGE_KEY = "explore-density";

/** Anything other than `"grid"` falls back to the compact layout. */
export function parseExploreDensity(value: string | null | undefined): ExploreDensity {
  return value === "grid" ? "grid" : "compact";
}

/**
 * Reads the saved layout for this browser. Storage can be unavailable (private
 * mode, blocked site data), so any failure returns the default.
 */
export function loadExploreDensity(): ExploreDensity {
  try {
    return parseExploreDensity(window.localStorage.getItem(EXPLORE_DENSITY_STORAGE_KEY));
  } catch {
    return "compact";
  }
}

/**
 * Saves the layout for this browser. Failures are ignored; the choice still
 * applies for the current visit.
 */
export function saveExploreDensity(density: ExploreDensity): void {
  try {
    window.localStorage.setItem(EXPLORE_DENSITY_STORAGE_KEY, density);
  } catch {
    // Non-fatal: the preference simply isn't remembered.
  }
}
