import { test, expect } from "@playwright/test";

/**
 * Smoke test for the core user navigation flow:
 * Home → Causes → Cause Detail → Dashboard
 *
 * This test runs with NEXT_PUBLIC_USE_MOCKS=true to validate
 * the critical user path without external dependencies.
 */
test.describe("Core User Flow Smoke Test", () => {
  test("should navigate from home to causes to cause detail to dashboard", async ({ page }) => {
    // Dismiss the onboarding tour so it doesn't intercept pointer events
    await page.addInitScript(() => {
      localStorage.setItem("onboarding_tour_dismissed", "1");
    });

    // Step 1: Navigate to Home page
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/(en|es)?\/?$/);
    await expect(page.locator("body")).toBeVisible();

    // Step 2: Navigate to Causes page
    // Look for navigation link or directly navigate
    const causesLink = page.locator('a[href*="causes"]').first();
    if (await causesLink.isVisible()) {
      await causesLink.click();
      await page.waitForURL(/\/causes/);
    } else {
      // Fallback: direct navigation if nav link not found
      await page.goto("/causes");
    }
    await expect(page).toHaveURL(/\/causes/);
    await expect(page.locator("body")).toBeVisible();

    // Step 3: Navigate to a specific Cause Detail page.
    // Navigate directly — CauseCard renders no anchor links to detail pages.
    // Wait for networkidle first so CausesClient's router.replace URL-sync
    // doesn't interrupt the next navigation (especially on webkit/firefox).
    await page.waitForLoadState("networkidle");
    await page.goto("/en/causes/1");
    // Use waitForURL with a lenient pattern to handle locale redirects and
    // any client-side URL changes that may happen on webkit/firefox.
    // Accepts: /en/causes/1, /es/causes/1, /causes/1, etc. (with optional query/hash)
    await page.waitForURL(/\/causes\/1/, { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();

    // Step 4: Navigate to Dashboard
    const dashboardLink = page.locator('a[href*="dashboard"]').first();
    if (await dashboardLink.isVisible()) {
      await dashboardLink.click();
      await page.waitForURL(/\/dashboard/);
    } else {
      // Fallback: direct navigation
      await page.goto("/dashboard");
    }
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator("body")).toBeVisible();
  });
});
