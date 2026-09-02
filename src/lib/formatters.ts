import { stroopsToXlm } from "@/lib/stellarAmount";

/**
 * Locale-aware formatting utilities using Intl APIs.
 * Pass the active locale (e.g. "en" | "es") from next-intl's useLocale().
 */

/** Format a number with locale-aware grouping/decimal separators. */
export function formatNumber(
  value: number,
  locale: string,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

/** Format an XLM amount with up to 2 decimal places. */
export function formatXlm(value: number, locale: string): string {
  return formatNumber(value, locale, { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}

export interface FormatAmountOptions {
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
}

/**
 * Format a raw stroops value (bigint, 1 XLM = 10_000_000 stroops) as a
 * locale-aware XLM string.
 *
 * IMPORTANT: always pass stroops, never a pre-divided XLM number.
 * Contract amounts (i128 / u128) come back as stroops — pass them directly.
 * If you already have an XLM number, use `formatXlm` instead.
 *
 * Verified call-site audit (issue #616): all current call sites in
 * AdminClient, ExploreClient, ProfileClient, HomeClient, FundingProgressBar,
 * DonationModal, CampaignActions, Amount, RevenueSharingPanel, and
 * networkFee.ts pass bigint stroops — no conversion needed at call sites.
 */
export function formatAmount(
  stroops: bigint,
  locale: string,
  options?: FormatAmountOptions,
): string {
  const xmlStr = stroopsToXlm(stroops);
  const xlmNum = parseFloat(xmlStr);
  return formatNumber(xlmNum, locale, {
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
  });
}

/**
 * Map of well-known Stellar asset tickers to their human-readable full names.
 * Used when displaying donation summaries or token amounts so users see
 * "USD Coin" instead of the often unclear ticker "USDC".
 */
const TOKEN_FULL_NAMES: Record<string, string> = {
  USDC: "USD Coin",
  XLM: "Stellar Lumens",
};

/**
 * Return the full display name for a token symbol/ticker.
 * Falls back to the symbol itself if no mapping is defined.
 */
export function formatTokenName(symbol: string): string {
  return TOKEN_FULL_NAMES[symbol] ?? symbol;
}

/** Format a Unix timestamp (seconds or milliseconds) as a locale-aware date string. */
export function formatDate(
  timestampSeconds: number,
  locale: string,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" },
): string {
  const tsMs =
    typeof timestampSeconds === "number" && timestampSeconds < 1e11
      ? timestampSeconds * 1000
      : timestampSeconds;
  return new Intl.DateTimeFormat(locale, options).format(new Date(tsMs));
}

/** Format a Unix timestamp (seconds or milliseconds) as a short date (e.g. "Jan 1, 2024"). */
export function formatShortDate(timestampSeconds: number, locale: string): string {
  return formatDate(timestampSeconds, locale, { year: "numeric", month: "short", day: "numeric" });
}
