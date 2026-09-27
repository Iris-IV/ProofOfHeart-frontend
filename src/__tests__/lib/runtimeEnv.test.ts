import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

describe("runtimeEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should validate client environment variables successfully", async () => {
    process.env.NEXT_PUBLIC_USE_MOCKS = "false";
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "true";

    const { clientEnv } = await import("@/lib/runtimeEnv");

    expect(clientEnv.NEXT_PUBLIC_USE_MOCKS).toBe(false);
    expect(clientEnv.NEXT_PUBLIC_ANALYTICS_ENABLED).toBe(true);
  });

  it("should default NEXT_PUBLIC_USE_MOCKS to false", async () => {
    delete process.env.NEXT_PUBLIC_USE_MOCKS;

    const { clientEnv } = await import("@/lib/runtimeEnv");

    expect(clientEnv.NEXT_PUBLIC_USE_MOCKS).toBe(false);
  });

  it("should validate optional environment variables", async () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
    process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL = "https://horizon-testnet.stellar.org";

    const { clientEnv } = await import("@/lib/runtimeEnv");

    expect(clientEnv.NEXT_PUBLIC_STELLAR_NETWORK).toBe("testnet");
    expect(clientEnv.NEXT_PUBLIC_STELLAR_HORIZON_URL).toBe("https://horizon-testnet.stellar.org");
  });

  it("should throw error for invalid NEXT_PUBLIC_USE_MOCKS value", () => {
    process.env.NEXT_PUBLIC_USE_MOCKS = "invalid";

    expect(() => {
      jest.isolateModules(() => {
        require("@/lib/runtimeEnv");
      });
    }).toThrow(/Client environment validation failed/);
  });

  it("should throw error when mock mode is enabled in production", async () => {
    process.env.NEXT_PUBLIC_USE_MOCKS = "true";
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "production",
      writable: true,
      configurable: true,
    });

    const { assertProductionContractConfig } = await import("@/lib/runtimeEnv");

    expect(() => {
      assertProductionContractConfig();
    }).toThrow(/Mock mode is disabled in production/);
  });

  it("should not throw error when mock mode is disabled in production", async () => {
    process.env.NEXT_PUBLIC_USE_MOCKS = "false";
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "production",
      writable: true,
      configurable: true,
    });

    const { assertProductionContractConfig } = await import("@/lib/runtimeEnv");

    expect(() => {
      assertProductionContractConfig();
    }).not.toThrow();
  });

  it("should maintain backward compatibility with IS_MOCK_MODE export", async () => {
    process.env.NEXT_PUBLIC_USE_MOCKS = "true";

    const { IS_MOCK_MODE } = await import("@/lib/runtimeEnv");

    expect(IS_MOCK_MODE).toBe(true);
  });
});
