import { test, expect } from "@playwright/test";

/**
 * Smoke tests for core page availability and navigation.
 *
 * The app uses next-intl locale routing — all pages live under /[locale]/,
 * e.g. /en/, /en/causes, /en/dashboard.  Requests to bare paths like /causes
 * are redirected to /en/causes by the middleware, so we navigate directly to
 * the canonical locale URLs to avoid redirect races.
 *
 * These tests run with NEXT_PUBLIC_USE_MOCKS=true (set in playwright.config.ts
 * webServer env) so no real Soroban RPC or Freighter extension is needed.
 */

test.describe("Smoke — page availability", () => {
  test("home page loads with app branding", async ({ page }) => {
    await page.goto("/en");
    await expect(page).toHaveURL(/\/en(\/)?$/);
    // The navbar logo / brand text is always visible
    await expect(page.locator("nav")).toBeVisible();
    // Page has meaningful content — not a blank white screen
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("causes list page loads and shows at least one campaign card", async ({ page }) => {
    await page.goto("/en/causes");
    await expect(page).toHaveURL(/\/en\/causes/);
    // Wait for mock data to render — CauseCard renders a heading per card
    await expect(page.locator("h2, h3").first()).toBeVisible({ timeout: 15000 });
  });

  test("cause detail page loads for campaign id 1", async ({ page }) => {
    await page.goto("/en/causes/1");
    await expect(page).toHaveURL(/\/en\/causes\/1/);
    // Title of the mock campaign
    await expect(page.getByText("Clean Water for Rural Communities")).toBeVisible({
      timeout: 15000,
    });
  });

  test("dashboard page renders without crashing", async ({ page }) => {
    await page.goto("/en/dashboard");
    await expect(page).toHaveURL(/\/en\/dashboard/);
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("about page renders without crashing", async ({ page }) => {
    await page.goto("/en/about");
    await expect(page).toHaveURL(/\/en\/about/);
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("health API endpoint returns ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
  });
});

test.describe("Smoke — navigation links", () => {
  test("navbar Causes link navigates to /en/causes", async ({ page }) => {
    await page.goto("/en");
    // Click the first nav link that points at /causes (locale-relative)
    const causesLink = page.locator('nav a[href*="causes"]').first();
    await expect(causesLink).toBeVisible();
    await causesLink.click();
    await expect(page).toHaveURL(/\/causes/, { timeout: 15000 });
  });

  test("bare /causes path redirects to /en/causes", async ({ page }) => {
    await page.goto("/causes");
    await expect(page).toHaveURL(/\/en\/causes/);
  });

  test("mock mode badge is shown in the navbar", async ({ page }) => {
    await page.goto("/en");
    // Mock Mode badge is visible when NEXT_PUBLIC_USE_MOCKS=true in non-production
    await expect(page.getByText("Mock Mode")).toBeVisible();
  });
});
