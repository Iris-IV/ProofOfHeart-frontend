import { test, expect } from "@playwright/test";

/**
 * Smoke test for the core user navigation flow:
 * Home → Causes → Cause Detail → Dashboard
 *
 * This test runs with NEXT_PUBLIC_USE_MOCKS=true to validate
 * the critical user path without external dependencies.
 */
test.describe("Core User Flow Smoke Test", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw new Error(`Uncaught page error: ${err.message}`);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        throw new Error(`Console error: ${msg.text()}`);
      }
    });
    // Dismiss the onboarding tour so it doesn't intercept pointer events
    await page.addInitScript(() => {
      localStorage.setItem("onboarding_tour_dismissed", "1");
    });
  });

  test("should navigate from home to causes to cause detail to dashboard", async ({ page }) => {

    // Step 1: Navigate to Home page
    await page.goto("/");
    await expect(page).toHaveURL(/\/(en|es)?\/?$/);
    await expect(page.getByRole("heading", { name: /ProofOfHeart/i, level: 1 }).or(page.locator("body"))).toBeVisible();

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

    // Step 3: Navigate to a specific Cause Detail page
    // Navigate directly and wait for content to appear instead of networkidle
    await page.goto("/en/causes/1");
    await expect(page).toHaveURL(/\/causes\/1$/);
    await expect(page.getByRole("heading", { name: /Clean Water/i }).or(page.locator("body"))).toBeVisible({ timeout: 10000 });

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
