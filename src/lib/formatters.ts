import { stroopsToXlm } from "../types";

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
 * Format stroops (bigint) as a locale-aware XLM string.
 * This is the canonical way to display XLM amounts across the app.
 */
export function formatAmount(
  stroops: bigint,
  locale: string,
  options?: FormatAmountOptions,
): string {
  const xlmStr = stroopsToXlm(stroops);
  const xlmNum = parseFloat(xlmStr);
  return formatNumber(xlmNum, locale, {
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
  });
}

/** Format a Unix timestamp (seconds) as a locale-aware date string. */
export function formatDate(
  timestampSeconds: number,
  locale: string,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" },
): string {
  return new Intl.DateTimeFormat(locale, options).format(
    new Date(timestampSeconds * 1000),
  );
}

/** Format a Unix timestamp (seconds) as a short date (e.g. "Jan 1, 2024"). */
export function formatShortDate(timestampSeconds: number, locale: string): string {
  return formatDate(timestampSeconds, locale, { year: "numeric", month: "short", day: "numeric" });
}
