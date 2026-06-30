import { test as base, expect } from "@playwright/test";

const ONBOARDING_DISMISSED_KEY = "onboarding_tour_dismissed";

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, "1");
    }, ONBOARDING_DISMISSED_KEY);
    await use(page);
  },
});

export { expect };
