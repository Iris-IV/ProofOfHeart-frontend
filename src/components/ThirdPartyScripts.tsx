"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { getAnalyticsScript, getThirdPartyScripts } from "@/lib/thirdParty";
import { flushAnalyticsQueue, hasOptedOutOfAnalytics } from "@/lib/analytics";

/**
 * Mounts every configured third-party script off the critical rendering path.
 *
 * #657 — Loading analytics or a support widget from a `<script>` in `<head>`
 * blocks the HTML parser until the vendor's CDN responds, then blocks the main
 * thread again while the payload is parsed and executed. Both costs land
 * squarely before Time to Interactive. `next/script` instead injects the tag
 * after hydration (`afterInteractive`) or during idle time following
 * `window.onload` (`lazyOnload`), so neither the first paint nor hydration
 * waits on a third party.
 *
 * Render this at the end of `<body>`, never inside `<head>`.
 */
export default function ThirdPartyScripts() {
  const scripts = getThirdPartyScripts();
  const analyticsId = getAnalyticsScript()?.id;

  // Do Not Track and the local opt-out both live in the browser, so the decision
  // cannot be made during SSR. Deferring it to an effect also keeps the server
  // and client markup identical on the first pass, avoiding a hydration
  // mismatch — the scripts are injected on the very next commit either way.
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    if (navigator.doNotTrack === "1") return;
    if (hasOptedOutOfAnalytics()) return;
    setConsented(true);
  }, []);

  if (!consented || scripts.length === 0) return null;

  return (
    <>
      {scripts.map(({ id, src, strategy, attributes }) => {
        // #647 — Guard: `beforeInteractive` runs during SSR and blocks the main
        // thread before hydration — exactly the problem this component exists to
        // solve. Any misconfigured entry is demoted to `lazyOnload` at runtime
        // and flagged in the dev console so it can be fixed in thirdParty.ts.
        const safeStrategy =
          (strategy as string) === "beforeInteractive"
            ? (process.env.NODE_ENV !== "production" &&
                console.warn(
                  `[ThirdPartyScripts] Script "${id}" uses "beforeInteractive" which blocks` +
                    ` the main thread. Downgraded to "lazyOnload". Fix the strategy in thirdParty.ts.`,
                ),
              "lazyOnload" as const)
            : strategy;

        return (
          <Script
            key={id}
            id={id}
            src={src}
            strategy={safeStrategy}
            // Funnel events fired during hydration are buffered by `analytics.ts`
            // until the vendor global exists; this is where they get drained.
            onLoad={id === analyticsId ? flushAnalyticsQueue : undefined}
            {...attributes}
          />
        );
      })}
    </>
  );
}
