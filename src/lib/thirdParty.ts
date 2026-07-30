/**
 * Configuration for every third-party script the app is allowed to load.
 *
 * #657 — Analytics and support widgets used to be candidates for a plain
 * `<script>` in `<head>`, which blocks HTML parsing and pushes Time to
 * Interactive out by the round-trip to the vendor's CDN. Nothing here is
 * rendered in `<head>`: `ThirdPartyScripts` mounts these through `next/script`
 * so the browser fetches them off the critical path.
 *
 * This module is deliberately free of React and Next imports so that
 * `next.config.ts` can import it to derive the Content-Security-Policy host
 * allow-list from the same source of truth as the loader.
 *
 * Every integration is opt-in. With no environment variables set, the app ships
 * zero third-party requests.
 */

/**
 * When each script is fetched.
 *
 * - `afterInteractive` — injected once the page has hydrated. Correct for
 *   analytics, which needs to observe the first page view but must not delay it.
 * - `lazyOnload` — injected during idle time after `window.onload`. Correct for
 *   support widgets, which are heavy, rarely used on the first screen, and whose
 *   own bundles would otherwise contend for the main thread during hydration.
 */
export type ScriptStrategy = "afterInteractive" | "lazyOnload";

export interface ThirdPartyScript {
  /** Stable identifier; `next/script` uses it to load the script only once. */
  id: string;
  src: string;
  strategy: ScriptStrategy;
  /** Extra DOM attributes, e.g. Plausible's `data-domain`. */
  attributes?: Record<string, string>;
}

/** Supported privacy-first analytics vendors. */
export type AnalyticsProvider = "plausible" | "umami";

/**
 * `process.env.NEXT_PUBLIC_*` is inlined at build time by a literal-text
 * substitution, so these must stay literal property reads — a computed lookup
 * such as `process.env[name]` resolves to `undefined` in the browser bundle.
 */
const ENV = {
  provider: process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER,
  analyticsSrc: process.env.NEXT_PUBLIC_ANALYTICS_SRC,
  analyticsDomain: process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN,
  analyticsWebsiteId: process.env.NEXT_PUBLIC_ANALYTICS_WEBSITE_ID,
  supportWidgetSrc: process.env.NEXT_PUBLIC_SUPPORT_WIDGET_SRC,
} as const;

const DEFAULT_ANALYTICS_SRC: Record<AnalyticsProvider, string> = {
  plausible: "https://plausible.io/js/script.js",
  umami: "https://cloud.umami.is/script.js",
};

function readProvider(): AnalyticsProvider | null {
  const raw = ENV.provider?.trim().toLowerCase();
  return raw === "plausible" || raw === "umami" ? raw : null;
}

/** Reject anything that is not an absolute https URL before it reaches the DOM. */
function parseHttpsUrl(raw: string | undefined): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/**
 * The analytics script, or `null` when analytics is not configured.
 *
 * Loaded `afterInteractive` rather than `lazyOnload`: waiting for `onload`
 * would lose the page view for visitors who bounce early, and the payload is
 * ~1 KB for both supported vendors.
 */
export function getAnalyticsScript(): ThirdPartyScript | null {
  const provider = readProvider();
  if (!provider) return null;

  const url = parseHttpsUrl(ENV.analyticsSrc ?? DEFAULT_ANALYTICS_SRC[provider]);
  if (!url) return null;

  const attributes: Record<string, string> = {};
  if (provider === "plausible") {
    const domain = ENV.analyticsDomain?.trim();
    // Plausible discards events whose data-domain does not match a registered site.
    if (!domain) return null;
    attributes["data-domain"] = domain;
  } else {
    const websiteId = ENV.analyticsWebsiteId?.trim();
    if (!websiteId) return null;
    attributes["data-website-id"] = websiteId;
  }

  return {
    id: `analytics-${provider}`,
    src: url.toString(),
    strategy: "afterInteractive",
    attributes,
  };
}

/**
 * The support/chat widget, or `null` when none is configured.
 *
 * Always `lazyOnload`. These bundles routinely exceed 100 KB and mount an
 * iframe; running them before the page is idle is the single biggest TTI
 * regression a widget can cause.
 */
export function getSupportWidgetScript(): ThirdPartyScript | null {
  const url = parseHttpsUrl(ENV.supportWidgetSrc);
  if (!url) return null;

  return {
    id: "support-widget",
    src: url.toString(),
    strategy: "lazyOnload",
  };
}

/** Every configured third-party script, in load order. */
export function getThirdPartyScripts(): ThirdPartyScript[] {
  return [getAnalyticsScript(), getSupportWidgetScript()].filter(
    (script): script is ThirdPartyScript => script !== null,
  );
}

/**
 * Origins the CSP must allow for the configured scripts.
 *
 * Consumed by `next.config.ts`, so the policy can never drift from what
 * `ThirdPartyScripts` actually injects. Widgets typically open a websocket and
 * load avatars from the same origin they are served from, which is why the
 * result is applied to `connect-src` and `img-src` as well as `script-src`.
 */
export function getThirdPartyScriptOrigins(): string[] {
  const origins = new Set<string>();
  for (const script of getThirdPartyScripts()) {
    try {
      origins.add(new URL(script.src).origin);
    } catch {
      // getThirdPartyScripts only ever emits parsed URLs; ignore defensively.
    }
  }
  return [...origins];
}

/** The analytics vendor in use, for the runtime event dispatcher. */
export function getAnalyticsProvider(): AnalyticsProvider | null {
  return getAnalyticsScript() ? readProvider() : null;
}
