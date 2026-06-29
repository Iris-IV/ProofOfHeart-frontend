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
  votingUI: boolean;
  analytics: boolean;
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

let cached: FeatureFlags | null = null;

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
