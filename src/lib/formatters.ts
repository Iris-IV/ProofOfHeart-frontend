import { STROOPS_PER_XLM, stroopsToXlm } from "@/lib/stellarAmount";

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

/** Format a raw stroops count as a grouped integer, e.g. 125000000n → "125,000,000". */
export function formatStroops(stroops: bigint, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(stroops);
}

/**
 * The exact XLM value of a stroops amount, keeping every one of the 7 decimal
 * places Stellar supports. Works on the bigint directly (no float rounding),
 * using the locale's grouping and decimal separators.
 */
export function formatExactXlm(stroops: bigint, locale: string): string {
  const negative = stroops < 0n;
  const abs = negative ? -stroops : stroops;
  const whole = abs / STROOPS_PER_XLM;
  const fraction = (abs % STROOPS_PER_XLM).toString().padStart(7, "0").replace(/0+$/, "");

  const formatter = new Intl.NumberFormat(locale);
  const decimalSeparator =
    formatter.formatToParts(1.1).find((part) => part.type === "decimal")?.value ?? ".";
  const formatted = formatter.format(whole) + (fraction ? `${decimalSeparator}${fraction}` : "");
  return negative ? `-${formatted}` : formatted;
}

export interface XlmAmountExplanation {
  /** Exact XLM value, e.g. "12.5000001". */
  xlm: string;
  /** The same amount in stroops, e.g. "125,000,001". */
  stroops: string;
  /** Stroops in one XLM, formatted: "10,000,000". */
  stroopsPerXlm: string;
}

/**
 * The pieces of the "what is a stroop?" tooltip (#1356): an amount shown
 * rounded in the UI, its exact XLM value, and its on-chain stroop count.
 */
export function getXlmAmountExplanation(stroops: bigint, locale: string): XlmAmountExplanation {
  return {
    xlm: formatExactXlm(stroops, locale),
    stroops: formatStroops(stroops, locale),
    stroopsPerXlm: formatStroops(STROOPS_PER_XLM, locale),
  };
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

/**
 * Native Intl.RelativeTimeFormat helper replacing heavy date libraries (#1584).
 * Formats relative time (e.g. "2 days ago", "in 3 hours").
 */
export function formatRelativeTime(
  timestampSeconds: number,
  locale: string = "en",
  nowMs: number = Date.now(),
): string {
  const tsMs =
    typeof timestampSeconds === "number" && timestampSeconds < 1e11
      ? timestampSeconds * 1000
      : timestampSeconds;
  const diffSec = Math.round((tsMs - nowMs) / 1000);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  const absSec = Math.abs(diffSec);
  if (absSec < 60) return rtf.format(diffSec, "second");
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, "hour");
  const diffDay = Math.round(diffHour / 24);
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, "day");
  const diffMonth = Math.round(diffDay / 30);
  if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, "month");
  const diffYear = Math.round(diffDay / 365);
  return rtf.format(diffYear, "year");
}

/**
 * Formats a start and end timestamp range using native Intl.DateTimeFormat.
 */
export function formatTimeRange(
  startSeconds: number,
  endSeconds: number,
  locale: string = "en",
): string {
  const startMs = startSeconds < 1e11 ? startSeconds * 1000 : startSeconds;
  const endMs = endSeconds < 1e11 ? endSeconds * 1000 : endSeconds;

  const dtf = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" });
  return dtf.formatRange(new Date(startMs), new Date(endMs));
}
