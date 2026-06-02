import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

// Expose the package version to client components at build time.
const pkg = JSON.parse(
  require("node:fs").readFileSync(require("node:path").join(__dirname, "package.json"), "utf-8")
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
    // Constrained remotePatterns for campaign media only
    // Removed broad wildcards to prevent SSRF attacks
    remotePatterns: [
      // IPFS gateways (for decentralized campaign images)
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "cloudflare-ipfs.com" },
      { protocol: "https", hostname: "ipfs.dweb.link" },
      // Arweave (for permanent campaign storage)
      { protocol: "https", hostname: "arweave.net" },
      // GitHub user content (for creator avatars, limited to raw.githubusercontent.com)
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      // Imgur (legacy support, consider migrating to IPFS)
      { protocol: "https", hostname: "i.imgur.com" },
      // Unsplash (for placeholder/demo images only)
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
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
    ];
  },
  async headers() {
    const CSP_DIRECTIVES = [
      // Default to same-origin for everything
      "default-src 'self'",
      // Allow scripts from self and inline scripts (needed for Freighter)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Allow styles from self and inline styles
      "style-src 'self' 'unsafe-inline'",
      // Allow images from self and allowed image domains
      "img-src 'self' data: https: blob:",
      // Allow fonts from self
      "font-src 'self' data:",
      // Allow connect to self, RPC endpoints, and Freighter extension
      "connect-src 'self' https://*.freighter.app https://soroban-testnet.stellar.org https://mainnet.stellar.validationcloud.io https://*.stellar.org",
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
        source: "/:path*",
        headers: [
          // Content Security Policy
          {
            key: "Content-Security-Policy",
            value: CSP_DIRECTIVES,
          },
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
                  value: "max-age=31536000; includeSubDomains; preload",
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
