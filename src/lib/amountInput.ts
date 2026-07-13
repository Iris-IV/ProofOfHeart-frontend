/**
 * Sanitize a donation-amount input value so it can never represent a negative
 * number.
 *
 * An `<input type="number" min="0">` does NOT prevent the user from typing a
 * leading minus sign (the `min` attribute only affects spin-button steps and
 * validation styling), and the `pattern` attribute is ignored on
 * `type="number"`. Stripping minus signs here guarantees the field never holds
 * a negative value, so a negative amount can never reach validation/submission.
 *
 * Note: this is intentionally minimal — it only removes `-` characters. All
 * other validation (NaN, decimals, goal cap, etc.) stays in `validateAmount`.
 */
export function sanitizeAmountInput(raw: string): string {
  if (!raw) return raw;
  return raw.replace(/-/g, "");
}
