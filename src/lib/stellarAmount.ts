/**
 * Stellar XLM amount conversion (1 XLM = 10_000_000 stroops).
 *
 * Use stroopsToXlm / xlmToStroops for contract-safe bigint math.
 * Use formatAmount from `@/lib/formatters` for locale-aware UI display.
 *
 * @see docs/STELLAR_AMOUNT.md
 */

export const STROOPS_PER_XLM = 10_000_000n;

/**
 * Convert stroops (i128) to a decimal XLM string without floating-point loss.
 */
export function stroopsToXlm(stroops: bigint): string {
  const stroopsStr = stroops.toString();
  if (stroopsStr.length <= 7) {
    const padded = stroopsStr.padStart(7, "0");
    const integerPart = "0";
    const fractionalPart = padded.slice(-7);
    const trimmedFractional = fractionalPart.replace(/0+$/, "");
    return trimmedFractional.length > 0 ? `${integerPart}.${trimmedFractional}` : "0";
  }

  const integerPart = stroopsStr.slice(0, -7);
  const fractionalPart = stroopsStr.slice(-7);
  const trimmedFractional = fractionalPart.replace(/0+$/, "");
  return trimmedFractional.length > 0 ? `${integerPart}.${trimmedFractional}` : integerPart;
}

/**
 * Convert an XLM string to stroops (bigint) for contract calls.
 */
export function xlmToStroops(xlm: string): bigint {
  const trimmed = xlm.trim();
  if (!trimmed) return BigInt(0);

  const parts = trimmed.split(".");
  const integerPart = parts[0] || "0";
  const fractionalPart = parts[1] || "";
  const paddedFractional = fractionalPart.padEnd(7, "0").slice(0, 7);

  return BigInt(integerPart + paddedFractional);
}

/**
 * Parse stroops to a JS number for charts or comparisons where IEEE precision is acceptable.
 * Prefer stroopsToXlm when serializing exact values (e.g. structured data).
 */
export function stroopsToXlmNumber(stroops: bigint): number {
  return Number(stroopsToXlm(stroops));
}
