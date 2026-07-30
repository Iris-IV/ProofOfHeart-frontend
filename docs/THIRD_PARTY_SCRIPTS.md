# Third-Party Scripts

How analytics and support widgets are loaded without delaying Time to Interactive (#657).

## The rule

**No third-party script may be added to `<head>`.** A `<script src="…">` there blocks the
HTML parser until the vendor's CDN responds, then blocks the main thread again while the
payload is parsed and executed — both costs land before the page becomes interactive.

Everything third-party is registered in [`src/lib/thirdParty.ts`](../src/lib/thirdParty.ts)
and mounted by [`src/components/ThirdPartyScripts.tsx`](../src/components/ThirdPartyScripts.tsx),
which renders at the end of `<body>` and injects each tag with `next/script`.

The one script that _is_ in `<head>` is the inline theme snippet in the locale layout. It
is inline (no network round-trip) and must run before first paint to avoid a flash of the
wrong colour scheme.

## Strategies

| Strategy           | When it runs                    | Used for       |
| ------------------ | ------------------------------- | -------------- |
| `afterInteractive` | after hydration                 | analytics      |
| `lazyOnload`       | during idle time after `onload` | support widget |

Analytics is `afterInteractive` rather than `lazyOnload` because waiting for `onload`
loses the page view for visitors who bounce early, and both supported vendors ship ~1 KB.
Support widgets are always `lazyOnload`: they routinely exceed 100 KB and mount an iframe,
so running them during hydration is the single biggest TTI regression a widget can cause.

`beforeInteractive` is deliberately never used.

## Configuration

Everything is opt-in. With no variables set, the app makes zero third-party requests.

```bash
# Analytics — "plausible" | "umami" | unset
NEXT_PUBLIC_ANALYTICS_PROVIDER=plausible
NEXT_PUBLIC_ANALYTICS_DOMAIN=proofofheart.xyz   # Plausible: the site in your dashboard
NEXT_PUBLIC_ANALYTICS_WEBSITE_ID=              # Umami: the website id
NEXT_PUBLIC_ANALYTICS_SRC=                     # optional, for self-hosting

# Support/chat widget (Crisp, Tawk, Intercom, …)
NEXT_PUBLIC_SUPPORT_WIDGET_SRC=https://client.crisp.chat/l.js
```

A half-configured provider — a vendor selected with no domain or website id — loads
nothing rather than firing events the vendor will silently discard. Script URLs must be
absolute `https:`; anything else is rejected before it reaches the DOM.

## CSP

`next.config.ts` calls `getThirdPartyScriptOrigins()` and appends the result to
`script-src`, `connect-src` and `frame-src`. The policy is derived from the same module
the loader renders from, so a newly configured vendor cannot be blocked by a stale
hand-maintained allow-list. `connect-src` and `frame-src` are included because analytics
beacons and widget websockets go back to the origin that served the script, and widgets
render their chat UI in an iframe they serve themselves.

## Consent

`ThirdPartyScripts` injects nothing when `navigator.doNotTrack === "1"` or the user has
opted out via `optOutOfAnalytics()`. That check runs in an effect rather than during
render, because neither signal is available during SSR and reading them inline would
produce a hydration mismatch.

## Event buffering

Funnel events fired during hydration can beat the analytics script, since it no longer
loads from a blocking `<head>` snippet. Rather than reintroduce one just to install the
vendor's queue stub, [`src/lib/analytics.ts`](../src/lib/analytics.ts) buffers up to 50
events and flushes them from the script's `onLoad`. The bound matters: ad blockers, CSP
rejections and vendor outages all mean the script may never arrive, and an unbounded queue
would grow for the lifetime of the tab.

## Adding a vendor

1. Add its config to `src/lib/thirdParty.ts` and return it from `getThirdPartyScripts()`.
2. Pick `lazyOnload` unless the script must observe the initial page view.
3. Add the environment variables to `.env.example`.
4. Extend `src/__tests__/lib/thirdParty.test.ts` — there is a test asserting that no
   script uses a blocking strategy.

The CSP updates itself.
