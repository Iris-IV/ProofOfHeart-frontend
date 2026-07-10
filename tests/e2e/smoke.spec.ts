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
    await expect(page).toHaveURL(/\/(en|es)?\/?$/);
    await expect(page.locator("body")).toBeVisible();

    // Step 2: Navigate to Causes page
    await page.goto("/en/causes");
    await expect(page).toHaveURL(/\/causes/);
    await expect(page.locator("body")).toBeVisible();

    // Step 3: Navigate to a specific Cause Detail page
    await page.goto("/en/causes/1");
    await expect(page).toHaveURL(/\/causes\/[^/]+$/);
    await expect(page.locator("body")).toBeVisible();

    // Step 4: Navigate to Dashboard
    await page.goto("/en/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator("body")).toBeVisible();
  });
});
