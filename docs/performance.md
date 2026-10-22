# Performance Benchmarks & Core Web Vitals SLA

Performance targets for the ProofOfHeart frontend, how they are measured today, and how to audit
and fix a regression.

- [SLA targets](#sla-targets)
- [How the SLA is enforced today](#how-the-sla-is-enforced-today)
- [Running an audit locally](#running-an-audit-locally)
- [Bundle-size budget](#bundle-size-budget)
- [Field data (real users)](#field-data-real-users)
- [Optimisation patterns already in the codebase](#optimisation-patterns-already-in-the-codebase)
- [Fixing a regression](#fixing-a-regression)
- [Audit checklist for pull requests](#audit-checklist-for-pull-requests)
- [Related](#related)

## SLA targets

Targets are evaluated at the **75th percentile** of page loads, on a mid-range mobile device over a
throttled 4G connection (Lighthouse's default mobile profile), for every public route.

| Metric                             | SLA target   | Google "good" threshold | Lab proxy (Lighthouse)           |
| ---------------------------------- | ------------ | ----------------------- | -------------------------------- |
| **LCP** — Largest Contentful Paint | **< 2.0 s**  | ≤ 2.5 s                 | LCP                              |
| **FID** — First Input Delay        | **< 100 ms** | ≤ 100 ms                | Total Blocking Time **< 200 ms** |
| **CLS** — Cumulative Layout Shift  | **< 0.05**   | ≤ 0.1                   | CLS                              |
| INP — Interaction to Next Paint    | < 200 ms     | ≤ 200 ms                | Total Blocking Time              |
| Lighthouse Performance score       | **≥ 90**     | —                       | Enforced in CI                   |

Notes:

- The LCP and CLS targets are deliberately stricter than Google's "good" thresholds, to leave
  headroom for slower networks and for the extra work a wallet extension adds to the page.
- **FID cannot be measured in a lab** — it needs a real user's first interaction. Lighthouse
  reports **Total Blocking Time (TBT)** instead; keep TBT under 200 ms to stay inside the FID
  target.
- Google replaced FID with **INP** as a Core Web Vital in March 2024. FID stays in this SLA for
  continuity; INP is tracked alongside it and should become the primary responsiveness metric once
  field data is collected (see [Field data](#field-data-real-users)).

## How the SLA is enforced today

The `Build and Test` job in `.github/workflows/ci.yml` runs on every pull request and push to
`main`:

1. `npm run build` produces the production build.
2. `npm run start` serves it on port 3000.
3. `treosh/lighthouse-ci-action@v12` audits `http://localhost:3000` **3 times** and uploads the
   reports as workflow artifacts (and to temporary public storage).
4. A `jq` step reads `.categories.performance.score` from the Lighthouse result and **fails the
   job if the score is below 90**.

What CI does **not** check yet:

| Gap                                               | Consequence                                                 |
| ------------------------------------------------- | ----------------------------------------------------------- |
| Only `/` is audited                               | `/causes`, `/causes/[id]`, `/admin` can regress unnoticed.  |
| Individual LCP/TBT/CLS values are not asserted    | A 90+ score can still hide an LCP above 2.0 s.              |
| `npm run bundle-size` is not part of any workflow | Bundle growth is caught only when someone runs it manually. |
| No real-user (field) metrics are collected        | The p75 SLA cannot be verified in production yet.           |

Per-metric checks can be added with a `lighthouserc.json` assertion block, for example:

```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000/en", "http://localhost:3000/en/causes"],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2000 }],
        "total-blocking-time": ["error", { "maxNumericValue": 200 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.05 }]
      }
    }
  }
}
```

and passed to the action with `configPath: ./lighthouserc.json`.

## Running an audit locally

Always audit a **production** build — `npm run dev` is unminified and much slower.

```bash
# The production build refuses to run with mocks on (scripts/validate-production-build.mjs).
# For a local audit against mock data, opt out explicitly:
NEXT_PUBLIC_USE_MOCKS=true SKIP_MOCK_CHECK=true npm run build
npm run start            # http://localhost:3000
```

Then, in another terminal, run the same audit CI runs:

```bash
npx --yes @lhci/cli autorun \
  --collect.url=http://localhost:3000 \
  --collect.numberOfRuns=3 \
  --upload.target=filesystem --upload.outputDir=./.lighthouseci
```

Or open the page in Chrome → DevTools → **Lighthouse** → _Mode: Navigation_, _Device: Mobile_,
_Category: Performance_. Use an incognito window so browser extensions (including Freighter) do not
skew the result.

> `npm run start` is used only for local audits; mock mode must never be deployed — the production
> server also refuses it at startup (`assertProductionContractConfig()` in
> `src/instrumentation.ts`).

### Interpreting results

- Compare the **median** of 3+ runs; single runs vary by ±5 points.
- Check the individual metrics against the [SLA table](#sla-targets), not just the score.
- The _Diagnostics_ section ("Reduce unused JavaScript", "Avoid large layout shifts", "Largest
  Contentful Paint element") points at the cause.

## Bundle-size budget

JavaScript is the main driver of TBT/FID and, on slow devices, of LCP.

```bash
npm run build
npm run bundle-size              # compare against scripts/bundle-size-baseline.json
npm run bundle-size:update       # after an intentional increase; commit the baseline
```

`scripts/bundle-size-check.mjs` sums the JS chunks listed in `.next/build-manifest.json` and
`.next/app-build-manifest.json` and fails when the total grows by more than **5 % or 50 KB,
whichever is larger**. To see what is inside a chunk:

```bash
npm run analyze                  # ANALYZE=true next build --webpack, opens the treemap
npm run build:analyze            # optimisation report + build with the compilation cache
```

## Field data (real users)

The app does not report Web Vitals from real users yet. Next.js exposes them through
`useReportWebVitals`; a minimal client reporter would be:

```tsx
"use client";

import { useReportWebVitals } from "next/web-vitals";

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    // metric.name: "LCP" | "FID" | "CLS" | "INP" | "FCP" | "TTFB"
    navigator.sendBeacon?.("/api/observability/events", JSON.stringify(metric));
  });
  return null;
}
```

Mounted once in `src/app/[locale]/layout.tsx`, it could feed the existing observability endpoint
(see [observability.md](./observability.md)) so the p75 SLA can be tracked per route. Check the
endpoint's accepted payload and the CSP `connect-src` before wiring it up.

## Optimisation patterns already in the codebase

Reuse these instead of inventing new ones:

| Concern               | Pattern                                                                                | Where                                                                      |
| --------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Heavy, rarely used UI | `next/dynamic` with `ssr: false`                                                       | `src/app/[locale]/admin/AdminClient.tsx` (map, 2FA, modals)                |
| Long lists            | `@tanstack/react-virtual` virtualisation                                               | `src/components/VirtualizedCampaignList.tsx`, `VirtualizedCauseGrid.tsx`   |
| Images                | `IntersectionObserver` lazy loading behind a placeholder                               | `src/components/LazyImage.tsx`, `src/lib/imageOptimization.enhanced.ts`    |
| Fonts                 | `next/font` (self-hosted, no layout shift from late font swaps)                        | `src/app/[locale]/layout.tsx`                                              |
| Third-party scripts   | Loaded through `ThirdPartyScripts` with an explicit `next/script` strategy             | `src/components/ThirdPartyScripts.tsx`, `src/lib/thirdParty.ts`            |
| Re-render cost        | React Compiler (`reactCompiler: true`) auto-memoises components                        | `next.config.ts`                                                           |
| Animation             | Short (≤ 150 ms) transform/opacity transitions; skipped under `prefers-reduced-motion` | `src/app/globals.css` (`--duration-fast`), `src/hooks/useReducedMotion.ts` |
| Loading states        | Skeletons sized like the final content, so swapping them in causes no CLS              | `src/components/Skeleton.tsx`                                              |

`images.unoptimized` is `true` in `next.config.ts` (standalone output, user media on IPFS/Arweave),
so Next.js does **not** resize or convert images. Size and compress uploads at the source, and
always give images explicit `width`/`height` (or an aspect-ratio box) to protect CLS.

## Fixing a regression

| Symptom                 | Usual causes                                                                    | First things to try                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| LCP > 2.0 s             | Large hero/cover image, render-blocking JS, slow RPC on the critical path       | Preload or shrink the LCP image; move data fetching off the first paint; `dynamic()` below-the-fold UI.                   |
| TBT > 200 ms / slow FID | Large client bundles, heavy work in effects, synchronous SDK setup              | `npm run analyze`; lazy-load `@stellar/stellar-sdk`-heavy paths; split long tasks.                                        |
| CLS > 0.05              | Images without dimensions, late-loading banners, skeleton/content size mismatch | Reserve space (`aspect-ratio`, fixed heights); match skeleton dimensions; avoid inserting content above existing content. |
| Score drops only in CI  | Lighthouse variance, cold server                                                | Re-run; compare the uploaded artifacts across runs before changing code.                                                  |

## Audit checklist for pull requests

Before requesting review on a change that touches pages, layout, dependencies or images:

- [ ] Lighthouse Performance ≥ 90 on every route the change affects (production build, mobile).
- [ ] LCP < 2.0 s, TBT < 200 ms, CLS < 0.05 in the same report.
- [ ] `npm run bundle-size` passes, or the baseline update is intentional and explained in the PR.
- [ ] New images have explicit dimensions; new heavy components are lazy-loaded.
- [ ] New animations are ≤ 150 ms, use `transform`/`opacity` and respect reduced motion.
- [ ] Attach the Lighthouse summary (or the CI artifact link) to the PR description.

## Related

- [CI-PIPELINE.md](./CI-PIPELINE.md) — the CI jobs, including Lighthouse
- [observability.md](./observability.md) — events and metrics endpoints
- [mobile.md](./mobile.md) and [MOBILE_AUDIT.md](./MOBILE_AUDIT.md) — mobile layout and audit
- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) — motion and duration tokens
- [turbopack.md](./turbopack.md) — build tooling
