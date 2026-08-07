/**
 * #637 — Fiat on-ramp URL/config tests.
 *
 * Env vars are inlined literally in the browser bundle, so the module reads
 * `process.env.NEXT_PUBLIC_*` at import time. We reset the module registry
 * between cases and re-require it after setting env, mirroring build behaviour.
 */

const ORIGINAL_ENV = process.env;

function loadModule() {
  let mod!: typeof import("@/lib/fiatOnramp");
  jest.isolateModules(() => {
    mod = require("@/lib/fiatOnramp");
  });
  return mod;
}

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER;
  delete process.env.NEXT_PUBLIC_RAMP_API_KEY;
  delete process.env.NEXT_PUBLIC_MOONPAY_API_KEY;
  process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("getFiatOnrampProvider", () => {
  it("returns null when no provider configured", () => {
    expect(loadModule().getFiatOnrampProvider()).toBeNull();
  });

  it("returns null when provider set but API key missing", () => {
    process.env.NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER = "ramp";
    expect(loadModule().getFiatOnrampProvider()).toBeNull();
  });

  it("returns 'ramp' when configured with a key", () => {
    process.env.NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER = "ramp";
    process.env.NEXT_PUBLIC_RAMP_API_KEY = "ramp_test_key";
    expect(loadModule().getFiatOnrampProvider()).toBe("ramp");
  });

  it("returns 'moonpay' when configured with a key", () => {
    process.env.NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER = "moonpay";
    process.env.NEXT_PUBLIC_MOONPAY_API_KEY = "pk_test_key";
    expect(loadModule().getFiatOnrampProvider()).toBe("moonpay");
  });

  it("ignores unknown provider values", () => {
    process.env.NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER = "bogus";
    process.env.NEXT_PUBLIC_RAMP_API_KEY = "ramp_test_key";
    expect(loadModule().getFiatOnrampProvider()).toBeNull();
  });
});

describe("buildFiatOnrampUrl", () => {
  it("throws when no provider is configured", () => {
    expect(() => loadModule().buildFiatOnrampUrl()).toThrow();
  });

  it("builds a Ramp testnet URL with wallet + amount", () => {
    process.env.NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER = "ramp";
    process.env.NEXT_PUBLIC_RAMP_API_KEY = "ramp_test_key";
    const url = new URL(loadModule().buildFiatOnrampUrl({ walletAddress: "GABC", fiatAmount: 50 }));
    expect(url.origin).toBe("https://app.demo.ramp.network");
    expect(url.searchParams.get("hostApiKey")).toBe("ramp_test_key");
    expect(url.searchParams.get("swapAsset")).toBe("XLM_XLM");
    expect(url.searchParams.get("userAddress")).toBe("GABC");
    expect(url.searchParams.get("fiatValue")).toBe("50");
  });

  it("uses the Ramp mainnet host on mainnet", () => {
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";
    process.env.NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER = "ramp";
    process.env.NEXT_PUBLIC_RAMP_API_KEY = "ramp_live_key";
    const url = new URL(loadModule().buildFiatOnrampUrl({ walletAddress: "GABC" }));
    expect(url.origin).toBe("https://app.ramp.network");
  });

  it("builds a MoonPay sandbox URL with wallet + amount", () => {
    process.env.NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER = "moonpay";
    process.env.NEXT_PUBLIC_MOONPAY_API_KEY = "pk_test_key";
    const url = new URL(loadModule().buildFiatOnrampUrl({ walletAddress: "GXYZ", fiatAmount: 25 }));
    expect(url.origin).toBe("https://buy-sandbox.moonpay.com");
    expect(url.searchParams.get("apiKey")).toBe("pk_test_key");
    expect(url.searchParams.get("currencyCode")).toBe("xlm");
    expect(url.searchParams.get("walletAddress")).toBe("GXYZ");
    expect(url.searchParams.get("baseCurrencyAmount")).toBe("25");
  });

  it("does not leak an API key when the address is absent", () => {
    process.env.NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER = "moonpay";
    process.env.NEXT_PUBLIC_MOONPAY_API_KEY = "pk_test_key";
    const url = new URL(loadModule().buildFiatOnrampUrl());
    expect(url.searchParams.has("walletAddress")).toBe(false);
  });
});

describe("getFiatOnrampProviderLabel", () => {
  it("maps provider ids to display labels", () => {
    const mod = loadModule();
    expect(mod.getFiatOnrampProviderLabel("ramp")).toBe("Ramp");
    expect(mod.getFiatOnrampProviderLabel("moonpay")).toBe("MoonPay");
  });
});
