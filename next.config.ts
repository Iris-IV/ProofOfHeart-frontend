import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { getThirdPartyScriptOrigins } from "./src/lib/thirdParty";
import { ALLOWED_CAMPAIGN_IMAGE_HOSTS } from "./src/lib/campaignMedia";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

// Expose the package version to client components at build time.
const pkg = JSON.parse(
  require("node:fs").readFileSync(require("node:path").join(__dirname, "package.json"), "utf-8"),
) as { version: string };

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  output: "standalone",
  reactCompiler: true,
  outputFileTracingRoot: path.join(__dirname),
  images: {
    // Image Optimization is disabled because:
    // 1. output: "standalone" requires minimal server dependencies
    // 2. Campaign images are user-provided and stored on IPFS/Arweave (decentralized storage)
    // 3. Next.js Image Optimization would require caching optimized images, which adds complexity
    // 4. Users upload images directly to IPFS/Arweave, not through our server
    unoptimized: true,
    // Constrained remotePatterns for campaign media only. Derived from the same
    // allow-list that gates server-side cover fetches (see src/lib/campaignMedia)
    // so the two can never drift — broad wildcards were removed to prevent SSRF.
    remotePatterns: ALLOWED_CAMPAIGN_IMAGE_HOSTS.map((hostname) => ({
      protocol: "https",
      hostname,
    })),
  },
  async redirects() {
    return [
      {
        source: "/explore",
        destination: "/causes",
        permanent: true,
      },
      {
        source: "/:locale/explore",
        destination: "/:locale/causes",
        permanent: true,
      },
      // Redirect non-localized cause detail URLs to the canonical localized form.
      // The next-intl middleware handles / and /(en|es)/:path* but bare /causes/:id
      // falls outside its matcher, so these explicit 308s close the gap.
      {
        source: "/causes/:id",
        destination: "/en/causes/:id",
        permanent: true,
      },
      {
        source: "/causes/:id/:path*",
        destination: "/en/causes/:id/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    // #657 — Derived from the same module that `ThirdPartyScripts` renders from,
    // so a newly configured analytics or support-widget origin can never be
    // blocked by a stale hand-maintained allow-list. Empty when nothing is
    // configured, which keeps the default policy exactly as tight as before.
    const thirdPartyOrigins = getThirdPartyScriptOrigins();
    const allow = (...origins: string[]) => origins.filter(Boolean).join(" ");

    const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://proofofheart.xyz";

    const CSP_DIRECTIVES = [
      // Default to same-origin for everything
      "default-src 'self'",
      // Allow scripts from self and inline scripts (needed for Freighter)
      `script-src ${allow("'self'", "'unsafe-inline'", "'unsafe-eval'", ...thirdPartyOrigins)}`,
      // Allow styles from self and inline styles
      "style-src 'self' 'unsafe-inline'",
      // Allow images from self and allowed image domains
      "img-src 'self' data: https: blob:",
      // Allow fonts from self
      "font-src 'self' data:",
      // Allow connect to self, RPC endpoints, and Freighter extension.
      // Third-party origins are included because analytics beacons and support
      // widget websockets go back to the origin that served their script.
      `connect-src ${allow(
        "'self'",
        "https://*.freighter.app",
        "https://soroban-testnet.stellar.org",
        "https://mainnet.stellar.validationcloud.io",
        "https://*.stellar.org",
        ...thirdPartyOrigins,
      )}`,
      // Support widgets render their chat UI inside an iframe they serve themselves.
      `frame-src ${allow("'self'", ...thirdPartyOrigins)}`,
      // Allow frame ancestors from same origin (no embedding)
      "frame-ancestors 'none'",
      // Allow forms from same origin
      "form-action 'self'",
      // Allow base URI to be same origin
      "base-uri 'self'",
      // Allow manifest from self
      "manifest-src 'self'",
    ].join("; ");

    return [
      {
        source: "/api/:path*",
        headers: [
          // Restrict CORS to production origin
          {
            key: "Access-Control-Allow-Origin",
            value: siteOrigin,
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
          {
            key: "Access-Control-Max-Age",
            value: "86400",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          // Prevent clickjacking
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // Prevent MIME type sniffing
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Referrer Policy for privacy
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // HSTS (only in production)
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
          // XSS Protection
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
    ];
  },
};

export default withAnalyzer(withNextIntl(nextConfig));
