/**
 * Tests for the feature-flag system in src/lib/featureFlags.ts.
 *
 * Primary goal: verify that resetFlagsCache() allows tests to mutate
 * process.env.NEXT_PUBLIC_FEATURE_* flags between test cases without
 * seeing stale cached values.
 */

import { getFlags, isEnabled, resetFlagsCache } from "@/lib/featureFlags";

const VOTING_KEY = "NEXT_PUBLIC_FEATURE_VOTINGUI";
const ANALYTICS_KEY = "NEXT_PUBLIC_FEATURE_ANALYTICS";
const EMBEDS_KEY = "NEXT_PUBLIC_FEATURE_EMBEDS";

function clearAllEnvVars() {
  delete process.env[VOTING_KEY];
  delete process.env[ANALYTICS_KEY];
  delete process.env[EMBEDS_KEY];
}

describe("featureFlags", () => {
  beforeEach(() => {
    clearAllEnvVars();
    resetFlagsCache();
  });

  afterEach(() => {
    clearAllEnvVars();
    resetFlagsCache();
  });

  describe("getFlags", () => {
    it("returns all defaults when no env vars are set", () => {
      const flags = getFlags();
      expect(flags).toEqual({
        votingUI: false,
        analytics: false,
        embeds: false,
      });
    });

    it("reads votingUI from env", () => {
      process.env[VOTING_KEY] = "true";
      resetFlagsCache();
      expect(getFlags().votingUI).toBe(true);
    });

    it("reads analytics from env", () => {
      process.env[ANALYTICS_KEY] = "1";
      resetFlagsCache();
      expect(getFlags().analytics).toBe(true);
    });

    it("reads embeds from env", () => {
      process.env[EMBEDS_KEY] = "true";
      resetFlagsCache();
      expect(getFlags().embeds).toBe(true);
    });

    it("treats '1' as truthy", () => {
      process.env[VOTING_KEY] = "1";
      resetFlagsCache();
      expect(getFlags().votingUI).toBe(true);
    });

    it("treats empty string as falsy (fallback to default)", () => {
      process.env[VOTING_KEY] = "";
      resetFlagsCache();
      expect(getFlags().votingUI).toBe(false); // default is false
    });
  });

  describe("isEnabled", () => {
    it("returns the value from getFlags", () => {
      process.env[VOTING_KEY] = "true";
      resetFlagsCache();
      expect(isEnabled("votingUI")).toBe(true);
      expect(isEnabled("analytics")).toBe(false);
    });
  });

  describe("test isolation (regression test for #559)", () => {
    it("sees fresh env values after resetFlagsCache is called", () => {
      // First call caches "false"
      expect(getFlags().votingUI).toBe(false);

      // Change env var — WITHOUT calling resetFlagsCache, the cache would hide this
      process.env[VOTING_KEY] = "true";
      resetFlagsCache();

      // Must now reflect the new value
      expect(getFlags().votingUI).toBe(true);
    });

    it("resetFlagsCache forces re-read even without env var change", () => {
      process.env[VOTING_KEY] = "true";
      resetFlagsCache();
      expect(getFlags().votingUI).toBe(true);

      // Reset without changing the env — should still return the same value
      resetFlagsCache();
      expect(getFlags().votingUI).toBe(true);
    });

    it("multiple flags can be toggled between test cases", () => {
      process.env[VOTING_KEY] = "true";
      process.env[ANALYTICS_KEY] = "1";
      resetFlagsCache();

      const flags1 = getFlags();
      expect(flags1.votingUI).toBe(true);
      expect(flags1.analytics).toBe(true);
      expect(flags1.embeds).toBe(false);

      // Simulate a different test case by resetting
      clearAllEnvVars();
      process.env[EMBEDS_KEY] = "true";
      resetFlagsCache();

      const flags2 = getFlags();
      expect(flags2.votingUI).toBe(false);
      expect(flags2.analytics).toBe(false);
      expect(flags2.embeds).toBe(true);
    });
  });
});
