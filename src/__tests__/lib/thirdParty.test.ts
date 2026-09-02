/**
 * #657 — The third-party script registry.
 *
 * Every value is read from `process.env` at module load, so each case reloads
 * the module inside `jest.isolateModules` with the environment it wants.
 */

type ThirdPartyModule = typeof import("@/lib/thirdParty");

const ENV_KEYS = [
  "NEXT_PUBLIC_ANALYTICS_PROVIDER",
  "NEXT_PUBLIC_ANALYTICS_SRC",
  "NEXT_PUBLIC_ANALYTICS_DOMAIN",
  "NEXT_PUBLIC_ANALYTICS_WEBSITE_ID",
  "NEXT_PUBLIC_SUPPORT_WIDGET_SRC",
] as const;

/** Load `thirdParty` with exactly the given env vars set. */
function loadWithEnv(env: Partial<Record<(typeof ENV_KEYS)[number], string>>): ThirdPartyModule {
  const original = { ...process.env };
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, env);

  let mod!: ThirdPartyModule;
  jest.isolateModules(() => {
    mod = require("@/lib/thirdParty");
  });

  process.env = original;
  return mod;
}

describe("thirdParty script registry", () => {
  it("loads nothing when no provider is configured", () => {
    const mod = loadWithEnv({});

    expect(mod.getAnalyticsScript()).toBeNull();
    expect(mod.getSupportWidgetScript()).toBeNull();
    expect(mod.getThirdPartyScripts()).toEqual([]);
    expect(mod.getThirdPartyScriptOrigins()).toEqual([]);
  });

  it("configures Plausible with its data-domain attribute", () => {
    const mod = loadWithEnv({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: "plausible",
      NEXT_PUBLIC_ANALYTICS_DOMAIN: "proofofheart.xyz",
    });

    expect(mod.getAnalyticsScript()).toEqual({
      id: "analytics-plausible",
      src: "https://plausible.io/js/script.js",
      strategy: "afterInteractive",
      attributes: { "data-domain": "proofofheart.xyz" },
    });
    expect(mod.getAnalyticsProvider()).toBe("plausible");
  });

  it("configures Umami with its website id", () => {
    const mod = loadWithEnv({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: "umami",
      NEXT_PUBLIC_ANALYTICS_WEBSITE_ID: "abc-123",
    });

    expect(mod.getAnalyticsScript()?.attributes).toEqual({ "data-website-id": "abc-123" });
  });

  it("honours a self-hosted script URL", () => {
    const mod = loadWithEnv({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: "plausible",
      NEXT_PUBLIC_ANALYTICS_DOMAIN: "proofofheart.xyz",
      NEXT_PUBLIC_ANALYTICS_SRC: "https://stats.example.com/js/script.js",
    });

    expect(mod.getAnalyticsScript()?.src).toBe("https://stats.example.com/js/script.js");
  });

  it("stays disabled when the vendor's required identifier is missing", () => {
    // Plausible silently discards events for an unregistered data-domain, so a
    // half-configured provider must not load at all.
    expect(
      loadWithEnv({ NEXT_PUBLIC_ANALYTICS_PROVIDER: "plausible" }).getAnalyticsScript(),
    ).toBeNull();
    expect(
      loadWithEnv({ NEXT_PUBLIC_ANALYTICS_PROVIDER: "umami" }).getAnalyticsScript(),
    ).toBeNull();
  });

  it("ignores unknown providers", () => {
    const mod = loadWithEnv({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: "google-analytics",
      NEXT_PUBLIC_ANALYTICS_DOMAIN: "proofofheart.xyz",
    });

    expect(mod.getAnalyticsScript()).toBeNull();
    expect(mod.getAnalyticsProvider()).toBeNull();
  });

  it("rejects non-https script URLs", () => {
    expect(
      loadWithEnv({
        NEXT_PUBLIC_SUPPORT_WIDGET_SRC: "http://widget.example.com/w.js",
      }).getSupportWidgetScript(),
    ).toBeNull();
    expect(
      loadWithEnv({
        NEXT_PUBLIC_SUPPORT_WIDGET_SRC: "javascript:alert(1)",
      }).getSupportWidgetScript(),
    ).toBeNull();
    expect(
      loadWithEnv({ NEXT_PUBLIC_SUPPORT_WIDGET_SRC: "not a url" }).getSupportWidgetScript(),
    ).toBeNull();
  });

  it("loads the support widget lazily, after window load", () => {
    const mod = loadWithEnv({ NEXT_PUBLIC_SUPPORT_WIDGET_SRC: "https://widget.example.com/w.js" });

    expect(mod.getSupportWidgetScript()).toEqual({
      id: "support-widget",
      src: "https://widget.example.com/w.js",
      strategy: "lazyOnload",
    });
  });

  it("never uses a blocking strategy", () => {
    const mod = loadWithEnv({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: "plausible",
      NEXT_PUBLIC_ANALYTICS_DOMAIN: "proofofheart.xyz",
      NEXT_PUBLIC_SUPPORT_WIDGET_SRC: "https://widget.example.com/w.js",
    });

    // The whole point of #657: nothing may run before the page is interactive.
    for (const script of mod.getThirdPartyScripts()) {
      expect(["afterInteractive", "lazyOnload"]).toContain(script.strategy);
    }
  });

  it("invokes a configured onError and warns when one is missing", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const mod = loadWithEnv({
        NEXT_PUBLIC_ANALYTICS_PROVIDER: "plausible",
        NEXT_PUBLIC_ANALYTICS_DOMAIN: "proofofheart.xyz",
      });

      // Script configs returned by the registry have no onError by default, so
      // handleScriptError surfaces the failure instead of swallowing it.
      const [script] = mod.getThirdPartyScripts();
      mod.handleScriptError(script);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(script.id));

      // When a consumer wires onError, handleScriptError invokes it instead.
      const onError = jest.fn();
      mod.handleScriptError({ ...script, onError });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("does not return duplicate script ids", () => {
    const mod = loadWithEnv({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: "plausible",
      NEXT_PUBLIC_ANALYTICS_DOMAIN: "proofofheart.xyz",
      NEXT_PUBLIC_SUPPORT_WIDGET_SRC: "https://widget.example.com/w.js",
    });

    const ids = mod.getThirdPartyScripts().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("derives CSP origins from the configured scripts", () => {
    const mod = loadWithEnv({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: "plausible",
      NEXT_PUBLIC_ANALYTICS_DOMAIN: "proofofheart.xyz",
      NEXT_PUBLIC_SUPPORT_WIDGET_SRC: "https://widget.example.com/path/w.js",
    });

    expect(mod.getThirdPartyScriptOrigins().sort()).toEqual([
      "https://plausible.io",
      "https://widget.example.com",
    ]);
  });
});
