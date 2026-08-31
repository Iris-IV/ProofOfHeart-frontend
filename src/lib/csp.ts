import { getThirdPartyScriptOrigins } from "./thirdParty";

/**
 * Request header name used to pass the per-request CSP nonce from middleware
 * to the layout so the theme blocking `<script>` can carry a matching nonce
 * attribute.  Defined here (not in middleware) so both files can import it
 * without layout ← middleware coupling.
 */
export const CSP_NONCE_HEADER = "x-csp-nonce";

/**
 * Generates a cryptographically random nonce for CSP script-src.
 *
 * `crypto.randomUUID()` is a global in Node 19+ and all modern browsers.
 * The project's minimum Node version is 22, so no explicit import is needed.
 */
export function generateCspNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

/**
 * Reads the Soroban RPC URL from environment configuration.
 * Falls back to the testnet default when not configured.
 */
export function getRpcUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
    process.env.NEXT_PUBLIC_RPC_URL ??
    "https://soroban-testnet.stellar.org"
  );
}

/**
 * Reads the Horizon server URL derived from the network passphrase.
 * Returns both testnet and mainnet URLs since the app can switch networks.
 */
function getHorizonUrls(): string[] {
  const passphrase = (
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015"
  ).toLowerCase();
  const isMainnet = !passphrase.includes("test");
  return isMainnet
    ? ["https://horizon.stellar.org"]
    : ["https://horizon-testnet.stellar.org", "https://horizon.stellar.org"];
}

/**
 * Resolves a URL from an environment variable, ensuring it's a valid https URL.
 * Returns null when the variable is empty or invalid.
 *
 * Only `https:` origins are accepted — CSP `connect-src` must never allow
 * unencrypted connections for a wallet-connected app.
 */
function parseEnvUrl(raw: string | undefined): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/**
 * Collects all origins the CSP must allow for `connect-src`:
 * - Own origin (`'self'`)
 * - Configured Soroban RPC URL(s)
 * - Horizon server(s) for balance queries
 * - Off-chain API base URL (if configured)
 * - Error tracking DSN (if configured)
 * - Third-party origins (analytics, support widgets)
 */
export function getConnectSrcOrigins(): string[] {
  const origins = new Set<string>();

  // Soroban RPC — always the public URL + optional private mainnet override.
  const rpcUrl = parseEnvUrl(getRpcUrl());
  if (rpcUrl) origins.add(rpcUrl.origin);

  // Private mainnet RPC URL that may carry an API key and differ from the
  // public NEXT_PUBLIC_* value.  Only available on the server side.
  const mainnetRpc = process.env.MAINNET_RPC_URL?.trim();
  if (mainnetRpc) {
    const parsed = parseEnvUrl(mainnetRpc);
    if (parsed) origins.add(parsed.origin);
  }

  // Horizon servers for balance queries.
  for (const url of getHorizonUrls()) {
    const parsed = parseEnvUrl(url);
    if (parsed) origins.add(parsed.origin);
  }

  // Off-chain API.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (apiUrl) {
    const fullUrl = apiUrl.startsWith("http") ? apiUrl : `https://${apiUrl}`;
    const parsed = parseEnvUrl(fullUrl);
    if (parsed) origins.add(parsed.origin);
  }

  // Error tracking DSN.
  const dsn = process.env.NEXT_PUBLIC_ERROR_TRACKING_DSN?.trim();
  if (dsn) {
    const parsed = parseEnvUrl(dsn);
    if (parsed) origins.add(parsed.origin);
  }

  // Third-party origins (analytics, support widgets).
  for (const origin of getThirdPartyScriptOrigins()) {
    origins.add(origin);
  }

  return [...origins];
}

/**
 * Options controlling the generated policy.
 */
export interface CspBuildOptions {
  /**
   * Build the policy for the development server, where it is delivered as
   * Content-Security-Policy-Report-Only. The policy is adjusted to that
   * context so browsers don't log structural warnings:
   * - `'unsafe-eval'` is allowed in script-src (the Turbopack dev runtime
   *   evaluates React Server Components code with `eval`)
   * - `frame-ancestors` is dropped (ignored in Report-Only; WebKit logs a
   *   console error about it)
   * - `report-to csp-endpoint` is added (WebKit warns that a Report-Only
   *   policy without `report-to` has no effect)
   */
  development?: boolean;
}

/**
 * Builds a strict Content-Security-Policy header value.
 *
 * - `script-src`: self + nonce-gated inline scripts + configured third-party
 *   origins.  No `'unsafe-inline'` — every inline `<script>` must carry a
 *   matching nonce.  `'unsafe-eval'` is excluded in production: neither the
 *   Stellar SDK nor Freighter's postMessage-based API requires it.
 * - `connect-src`: self + Soroban RPC + Horizon + off-chain API + error
 *   tracking + third-party origins.  No broad wildcards.
 *
 * @param nonce Base64-encoded nonce for the current request.
 * @param options See {@link CspBuildOptions}.
 */
export function buildCspHeader(nonce: string, options: CspBuildOptions = {}): string {
  const { development = false } = options;
  const allow = (...origins: string[]) => origins.filter(Boolean).join(" ");
  const thirdPartyOrigins = getThirdPartyScriptOrigins();
  const connectOrigins = getConnectSrcOrigins();

  // `'unsafe-inline'` is deliberately absent from script-src — every inline
  // `<script>` must carry a matching nonce, which middleware generates
  // per-request. `'unsafe-eval'` is only added back in dev (see middleware).
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, ...thirdPartyOrigins];
  if (development) {
    scriptSrc.push("'unsafe-eval'");
  }

  const directives = [
    "default-src 'self'",
    // Scripts: self, nonce-gated inline scripts, and configured third-party CDNs.
    `script-src ${scriptSrc.join(" ")}`,
    // Styles: self and unsafe-inline (React + Tailwind inject styles via DOM APIs,
    // not through `<style>` tags, but the CSP still sees them as inline).
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    `connect-src ${allow("'self'", ...connectOrigins)}`,
    `frame-src ${allow("'self'", ...thirdPartyOrigins)}`,
    ...(development ? [] : ["frame-ancestors 'none'"]),
    "form-action 'self'",
    "base-uri 'self'",
    "manifest-src 'self'",
    ...(development ? ["report-to csp-endpoint"] : []),
  ];

  return directives.join("; ");
}
