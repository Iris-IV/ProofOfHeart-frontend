// RTL locale registry — extend this list when adding right-to-left locales (ar, he, fa, ur…).
// Currently all configured locales (en, es) are LTR; the infrastructure is here for when
// an RTL locale is added to src/i18n/routing.ts.
const RTL_LOCALES = new Set<string>(["ar", "he", "fa", "ur"]);

export type TextDirection = "ltr" | "rtl";

export function getTextDirection(locale: string): TextDirection {
  return RTL_LOCALES.has(locale) ? "rtl" : "ltr";
}
