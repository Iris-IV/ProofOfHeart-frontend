import { test as base, expect } from "@playwright/test";

const ONBOARDING_DISMISSED_KEY = "onboarding_tour_dismissed";
const DEFAULT_LOCALE = "en";

export const test = base.extend({
  page: async ({ page }, runWithPage) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, "1");
    }, ONBOARDING_DISMISSED_KEY);
    await runWithPage(page);
  },
});

export { expect };

export function localePath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/") {
    return `/${DEFAULT_LOCALE}`;
  }
  return `/${DEFAULT_LOCALE}${normalized}`;
}
