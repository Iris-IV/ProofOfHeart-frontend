import {
  DEFAULT_CONTRIBUTE_NETWORK_FEE_STROOPS,
  DEFAULT_SOROBAN_RESOURCE_LIMITS,
  computeResourceLimits,
  getEstimatedContributeNetworkFeeStroops,
  getEstimatedContributeNetworkFeeXlm,
  formatEstimatedNetworkFeeXlm,
} from "@/lib/networkFee";

/**
 * Current fallback when no estimate source is available: 100_000 stroops (= 0.01 XLM).
 * This value is expected to change once issue #618 is resolved (dynamic fee via RPC).
 */
const ENV_KEY = "NEXT_PUBLIC_ESTIMATED_CONTRIBUTE_NETWORK_FEE_STROOPS";

describe("networkFee", () => {
  const originalEnv = process.env[ENV_KEY];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = originalEnv;
    }
  });

  describe("estimate-source fallback", () => {
    it("falls back to DEFAULT_CONTRIBUTE_NETWORK_FEE_STROOPS when env var is unset", () => {
      delete process.env[ENV_KEY];
      expect(getEstimatedContributeNetworkFeeStroops()).toBe(
        DEFAULT_CONTRIBUTE_NETWORK_FEE_STROOPS,
      );
      expect(getEstimatedContributeNetworkFeeXlm()).toBe(0.01);
    });

    it.each([
      ["empty string", ""],
      ["whitespace only", "  "],
      ["zero", "0"],
      ["negative number", "-100"],
      ["non-numeric string", "abc"],
    ])("falls back to DEFAULT_CONTRIBUTE_NETWORK_FEE_STROOPS when env var is %s", (_, val) => {
      process.env[ENV_KEY] = val;
      expect(getEstimatedContributeNetworkFeeStroops()).toBe(
        DEFAULT_CONTRIBUTE_NETWORK_FEE_STROOPS,
      );
    });
  });

  describe("successful estimate response mapping", () => {
    it("maps a valid env var value to the expected stroops and XLM", () => {
      process.env[ENV_KEY] = "200000";
      expect(getEstimatedContributeNetworkFeeStroops()).toBe(200_000n);
      expect(getEstimatedContributeNetworkFeeXlm()).toBe(0.02);
    });
  });

  describe("formatEstimatedNetworkFeeXlm", () => {
    it("formats the fallback value as a locale-appropriate XLM string", () => {
      delete process.env[ENV_KEY];
      expect(formatEstimatedNetworkFeeXlm()).toBe("0.01");
    });

    it("formats an env-override estimate as a locale-appropriate XLM string", () => {
      process.env[ENV_KEY] = "200000";
      expect(formatEstimatedNetworkFeeXlm()).toBe("0.02");
    });
  });

  describe("computeResourceLimits", () => {
    it("pads the simulated footprint with headroom", () => {
      const limits = computeResourceLimits({
        instructions: 1_000_000,
        readBytes: 1_000,
        writeBytes: 500,
      });
      expect(limits.instructions).toBe(1_100_000);
      expect(limits.readBytes).toBe(1_100);
      expect(limits.writeBytes).toBe(550);
    });

    it("falls back per-dimension when the footprint value is missing or invalid", () => {
      const limits = computeResourceLimits({ instructions: 0, readBytes: undefined });
      expect(limits.instructions).toBe(DEFAULT_SOROBAN_RESOURCE_LIMITS.instructions);
      expect(limits.readBytes).toBe(DEFAULT_SOROBAN_RESOURCE_LIMITS.readBytes);
      expect(limits.writeBytes).toBe(DEFAULT_SOROBAN_RESOURCE_LIMITS.writeBytes);
    });

    it("accepts an explicit headroom multiplier", () => {
      const limits = computeResourceLimits({ instructions: 1_000 }, { headroomMultiplier: 2 });
      expect(limits.instructions).toBe(2_000);
    });
  });
});
