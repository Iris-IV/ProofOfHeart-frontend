/**
 * #637 — Fiat-to-crypto on-ramp configuration.
 *
 * Non-crypto-native supporters can't donate without first acquiring XLM. This
 * module builds a hosted-widget checkout URL for a fiat on-ramp provider (Ramp
 * or MoonPay) so the donation flow can hand off to a card/bank purchase that
 * deposits XLM straight into the supporter's wallet.
 *
 * Everything is driven by public environment variables and is entirely opt-in:
 * with no provider key configured, no on-ramp UI is shown and no third-party
 * request is made. No secrets live here — only the publishable client key each
 * provider issues for hosted-widget URLs.
 *
 * `process.env.NEXT_PUBLIC_*` is inlined at build time by literal-text
 * substitution, so these must stay literal property reads.
 */

export type FiatOnrampProvider = "ramp" | "moonpay";

const RAMP_HOSTS = {
  testnet: "https://app.demo.ramp.network",
  mainnet: "https://app.ramp.network",
} as const;

const MOONPAY_HOSTS = {
  testnet: "https://buy-sandbox.moonpay.com",
  mainnet: "https://buy.moonpay.com",
} as const;

const ENV = {
  provider: process.env.NEXT_PUBLIC_FIAT_ONRAMP_PROVIDER,
  rampApiKey: process.env.NEXT_PUBLIC_RAMP_API_KEY,
  moonpayApiKey: process.env.NEXT_PUBLIC_MOONPAY_API_KEY,
  network: process.env.NEXT_PUBLIC_STELLAR_NETWORK,
};

function normalizeProvider(value: string | undefined): FiatOnrampProvider | null {
  if (value === "ramp" || value === "moonpay") return value;
  return null;
}

function isMainnet(): boolean {
  return ENV.network === "mainnet";
}

/**
 * The configured on-ramp provider, or `null` when the feature is disabled or
 * missing its API key. UI should hide the on-ramp entry point when this is null.
 */
export function getFiatOnrampProvider(): FiatOnrampProvider | null {
  const provider = normalizeProvider(ENV.provider);
  if (!provider) return null;
  if (provider === "ramp" && !ENV.rampApiKey) return null;
  if (provider === "moonpay" && !ENV.moonpayApiKey) return null;
  return provider;
}

/** Human-readable provider label for UI ("Ramp", "MoonPay"). */
export function getFiatOnrampProviderLabel(provider: FiatOnrampProvider): string {
  return provider === "ramp" ? "Ramp" : "MoonPay";
}

export interface FiatOnrampParams {
  /** Destination Stellar wallet address the purchased XLM should be sent to. */
  walletAddress?: string | null;
  /** Optional pre-filled fiat amount hint (provider dependent). */
  fiatAmount?: number | null;
}

function buildRampUrl(apiKey: string, params: FiatOnrampParams): string {
  const host = isMainnet() ? RAMP_HOSTS.mainnet : RAMP_HOSTS.testnet;
  const url = new URL(host);
  url.searchParams.set("hostApiKey", apiKey);
  url.searchParams.set("swapAsset", "XLM_XLM");
  url.searchParams.set("defaultAsset", "XLM_XLM");
  if (params.walletAddress) url.searchParams.set("userAddress", params.walletAddress);
  if (params.fiatAmount && params.fiatAmount > 0) {
    url.searchParams.set("fiatValue", String(params.fiatAmount));
    url.searchParams.set("fiatCurrency", "USD");
  }
  return url.toString();
}

function buildMoonpayUrl(apiKey: string, params: FiatOnrampParams): string {
  const host = isMainnet() ? MOONPAY_HOSTS.mainnet : MOONPAY_HOSTS.testnet;
  const url = new URL(host);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("currencyCode", "xlm");
  if (params.walletAddress) url.searchParams.set("walletAddress", params.walletAddress);
  if (params.fiatAmount && params.fiatAmount > 0) {
    url.searchParams.set("baseCurrencyAmount", String(params.fiatAmount));
    url.searchParams.set("baseCurrencyCode", "usd");
  }
  return url.toString();
}

/**
 * Build the hosted-widget checkout URL for the active provider.
 *
 * @throws if no provider is configured — callers should gate on
 * `getFiatOnrampProvider()` first.
 */
export function buildFiatOnrampUrl(params: FiatOnrampParams = {}): string {
  const provider = getFiatOnrampProvider();
  if (provider === "ramp" && ENV.rampApiKey) {
    return buildRampUrl(ENV.rampApiKey, params);
  }
  if (provider === "moonpay" && ENV.moonpayApiKey) {
    return buildMoonpayUrl(ENV.moonpayApiKey, params);
  }
  throw new Error("Fiat on-ramp is not configured");
}
