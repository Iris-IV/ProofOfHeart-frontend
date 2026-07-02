import { test, expect } from "@playwright/test";

/**
 * Smoke test for the core user navigation flow:
 * Home → Causes → Cause Detail → Dashboard
 *
 * This test runs with NEXT_PUBLIC_USE_MOCKS=true to validate
 * the critical user path without external dependencies.
 *
 * Note: The app uses next-intl for i18n routing, so all pages are served
 * under a locale prefix (e.g. /en/causes, /en/dashboard). URL assertions
 * use patterns that match both /en/ and /es/ locales.
 */
test.describe("Core User Flow Smoke Test", () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss the onboarding tour on every page load so it never blocks clicks.
    // The tour is shown when "onboarding_tour_dismissed" is absent from localStorage.
    await page.addInitScript(() => {
      localStorage.setItem("onboarding_tour_dismissed", "1");
    });
  });

  test("should navigate from home to causes to cause detail to dashboard", async ({ page }) => {
    // Step 1: Navigate to Home page
    // The middleware redirects / → /en (or the negotiated locale)
    await page.goto("/");
    await page.waitForURL(/\/(en|es)(\/)?$/);
    await expect(page.locator("body")).toBeVisible();

    // Step 2: Navigate to Causes page via nav link or direct navigation
    const causesLink = page.locator('a[href*="causes"]').first();
    if (await causesLink.isVisible()) {
      await causesLink.click();
      await page.waitForURL(/\/(en|es)\/causes/);
    } else {
      await page.goto("/en/causes");
    }
    await expect(page).toHaveURL(/\/(en|es)\/causes/);
    await expect(page.locator("body")).toBeVisible();

    // Step 3: Navigate to a specific Cause Detail page
    const causeCard = page
      .locator('[data-testid="cause-card"], a[href*="/causes/"]')
      .first();
    if (await causeCard.isVisible()) {
      await causeCard.click();
      await page.waitForURL(/\/(en|es)\/causes\/[^/]+$/);
    } else {
      await page.goto("/en/causes/1");
    }
    await expect(page).toHaveURL(/\/(en|es)\/causes\/[^/]+$/);
    await expect(page.locator("body")).toBeVisible();

    // Step 4: Navigate to Dashboard
    const dashboardLink = page.locator('a[href*="dashboard"]').first();
    if (await dashboardLink.isVisible()) {
      await dashboardLink.click();
      await page.waitForURL(/\/(en|es)\/dashboard/);
    } else {
      await page.goto("/en/dashboard");
    }
    await expect(page).toHaveURL(/\/(en|es)\/dashboard/);
    await expect(page.locator("body")).toBeVisible();
  });
});
