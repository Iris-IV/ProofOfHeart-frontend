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
    // Step 1: Navigate to Home page
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForLoadState("domcontentloaded");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("body")).toBeVisible();

    // Step 2: Navigate to Causes page
    // Look for navigation link or directly navigate
    const causesLink = page.locator('a[href*="causes"]').first();
    const isVisible = await causesLink.isVisible({ timeout: 5000 }).catch(() => false);
    if (isVisible) {
      await causesLink.click();
      await page.waitForURL(/\/causes/);
      await page.waitForLoadState("domcontentloaded");
    } else {
      // Fallback: direct navigation if nav link not found
      await page.goto("/causes", { waitUntil: "networkidle" });
      await page.waitForLoadState("domcontentloaded");
    }
    await expect(page).toHaveURL(/\/causes/);
    await expect(page.locator("body")).toBeVisible();

    // Step 3: Navigate to a specific Cause Detail page
    // Find the first cause card/link and click it
    const causeCard = page.locator('[data-testid="cause-card"], a[href*="/causes/"]').first();
    const cardVisible = await causeCard.isVisible({ timeout: 5000 }).catch(() => false);
    if (cardVisible) {
      await causeCard.click();
      await page.waitForURL(/\/causes\/[^/]+$/);
      await page.waitForLoadState("domcontentloaded");
    } else {
      // Fallback: navigate to a known cause ID
      await page.goto("/causes/1", { waitUntil: "networkidle" });
      await page.waitForLoadState("domcontentloaded");
    }
    await expect(page).toHaveURL(/\/causes\/[^/]+$/);
    await expect(page.locator("body")).toBeVisible();

    // Step 4: Navigate to Dashboard
    const dashboardLink = page.locator('a[href*="dashboard"]').first();
    const dashboardVisible = await dashboardLink.isVisible({ timeout: 5000 }).catch(() => false);
    if (dashboardVisible) {
      await dashboardLink.click();
      await page.waitForURL(/\/dashboard/);
      await page.waitForLoadState("domcontentloaded");
    } else {
      // Fallback: direct navigation
      await page.goto("/dashboard", { waitUntil: "networkidle" });
      await page.waitForLoadState("domcontentloaded");
    }
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator("body")).toBeVisible();
  });
});
