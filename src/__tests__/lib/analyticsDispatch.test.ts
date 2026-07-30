/**
 * #657 — Because the vendor script is now injected after hydration instead of
 * from a blocking `<head>` tag, events can be fired before `window.plausible`
 * exists. They must be buffered and flushed, not dropped.
 */

// `window.plausible` / `window.umami` are declared globally by `@/lib/analytics`.
type AnalyticsModule = typeof import("@/lib/analytics");

function loadAnalytics(env: Record<string, string>): AnalyticsModule {
  const original = { ...process.env };
  Object.assign(process.env, env);

  let mod!: AnalyticsModule;
  jest.isolateModules(() => {
    mod = require("@/lib/analytics");
  });

  process.env = original;
  return mod;
}

const PLAUSIBLE_ENV = {
  NEXT_PUBLIC_ANALYTICS_PROVIDER: "plausible",
  NEXT_PUBLIC_ANALYTICS_DOMAIN: "proofofheart.xyz",
};

describe("analytics event dispatch", () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.plausible;
    delete window.umami;
  });

  it("buffers events fired before the deferred script loads, then flushes them in order", () => {
    const analytics = loadAnalytics(PLAUSIBLE_ENV);

    analytics.trackViewCampaign(7);
    analytics.trackClickContribute(7);

    const plausible = jest.fn();
    window.plausible = plausible;
    analytics.flushAnalyticsQueue();

    expect(plausible).toHaveBeenCalledTimes(2);
    expect(plausible.mock.calls[0][0]).toBe("contribution_funnel");
    expect(plausible.mock.calls[0][1].props.step).toBe("funnel_view_campaign");
    expect(plausible.mock.calls[1][1].props.step).toBe("funnel_click_contribute");
  });

  it("sends straight through once the vendor global exists", () => {
    const analytics = loadAnalytics(PLAUSIBLE_ENV);
    const plausible = jest.fn();
    window.plausible = plausible;

    analytics.trackConnectWallet();

    expect(plausible).toHaveBeenCalledTimes(1);
  });

  it("routes to Umami's track API when that is the configured vendor", () => {
    const analytics = loadAnalytics({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: "umami",
      NEXT_PUBLIC_ANALYTICS_WEBSITE_ID: "abc-123",
    });
    const track = jest.fn();
    window.umami = { track };

    analytics.trackContributionConfirmed(3);

    expect(track).toHaveBeenCalledWith("contribution_funnel", expect.objectContaining({}));
  });

  it("drops events entirely when the user has opted out", () => {
    const analytics = loadAnalytics(PLAUSIBLE_ENV);
    const plausible = jest.fn();
    window.plausible = plausible;

    analytics.optOutOfAnalytics();
    analytics.trackViewCampaign(1);

    expect(plausible).not.toHaveBeenCalled();
    expect(analytics.hasOptedOutOfAnalytics()).toBe(true);

    analytics.optInToAnalytics();
    analytics.trackViewCampaign(1);
    expect(plausible).toHaveBeenCalledTimes(1);
  });

  it("never sends a raw campaign id", () => {
    const analytics = loadAnalytics(PLAUSIBLE_ENV);
    const plausible = jest.fn();
    window.plausible = plausible;

    analytics.trackViewCampaign(4242);

    expect(plausible.mock.calls[0][1].props.campaignId).toBe("campaign_242");
  });

  it("bounds the buffer so a blocked vendor cannot grow it without limit", () => {
    const analytics = loadAnalytics(PLAUSIBLE_ENV);

    // Ad blockers and CSP rejections mean the script may simply never arrive.
    for (let i = 0; i < 200; i += 1) analytics.trackViewCampaign(i);

    const plausible = jest.fn();
    window.plausible = plausible;
    analytics.flushAnalyticsQueue();

    expect(plausible).toHaveBeenCalledTimes(50);
  });

  it("is a no-op when no provider is configured", () => {
    const analytics = loadAnalytics({ NEXT_PUBLIC_ANALYTICS_PROVIDER: "" });
    const plausible = jest.fn();
    window.plausible = plausible;

    analytics.trackViewCampaign(1);
    analytics.flushAnalyticsQueue();

    expect(plausible).not.toHaveBeenCalled();
  });
});
