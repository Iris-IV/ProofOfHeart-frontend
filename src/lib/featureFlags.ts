/**
 * Feature flag system for staged rollout of new features.
 *
 * Flags are driven by `NEXT_PUBLIC_FEATURE_*` environment variables.
 * Defaults are safe for production — new features ship disabled.
 *
 * Usage:
 *   import { isEnabled } from "@/lib/featureFlags";
 *   if (isEnabled("votingUI")) { ... }
 */

export interface FeatureFlags {
  /** Controls whether the voting UI is shown on cause detail pages.
   *  Environment variable: `NEXT_PUBLIC_FEATURE_VOTINGUI`
   *  Default: `false` */
  votingUI: boolean;
  /** Controls whether analytics event tracking is enabled.
   *  Environment variable: `NEXT_PUBLIC_FEATURE_ANALYTICS`
   *  Default: `false` */
  analytics: boolean;
  /** Controls whether embedded content (e.g. social media embeds) is enabled.
   *  Environment variable: `NEXT_PUBLIC_FEATURE_EMBEDS`
   *  Default: `false` */
  embeds: boolean;
}

const DEFAULTS: FeatureFlags = {
  votingUI: false,
  analytics: false,
  embeds: false,
};

function readFlag(name: string, fallback: boolean): boolean {
  const key = `NEXT_PUBLIC_FEATURE_${name.toUpperCase()}`;
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  return raw === "true" || raw === "1";
}

/** Module-level cache populated once at first access.
 *  Environment variables read during initialization are not re-evaluated
 *  when they change at runtime. Restart the dev server after modifying
 *  any `NEXT_PUBLIC_FEATURE_*` variable.
 *  @see https://github.com/Iris-IV/ProofOfHeart-frontend/issues/559 */
let cached: FeatureFlags | null = null;

/**
 * Reset the feature-flags cache. Intended for tests where env vars
 * change between test cases, ensuring test isolation (see #559).
 */
export function resetFlagsCache(): void {
  cached = null;
}

export function getFlags(): FeatureFlags {
  if (cached) return cached;
  cached = {
    votingUI: readFlag("votingUI", DEFAULTS.votingUI),
    analytics: readFlag("analytics", DEFAULTS.analytics),
    embeds: readFlag("embeds", DEFAULTS.embeds),
  };
  return cached;
}

export function isEnabled(flag: keyof FeatureFlags): boolean {
  return getFlags()[flag];
}
