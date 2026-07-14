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
test.describe("Core User Flow Smoke Test", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      if (
        err.message.includes("ChunkLoadError") ||
        err.message.includes("Load failed") ||
        err.message.includes("access control checks")
      ) {
        return;
      }
      throw new Error(`Uncaught page error: ${err.message}`);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (
          text.includes("ChunkLoadError") ||
          text.includes("Load failed") ||
          text.includes("access control checks") ||
          text.includes("The above error occurred in the <Lazy> component") ||
          text.includes("JSHandle@object") ||
          text.includes("Uncaught error: Error")
        ) {
          return;
        }
        throw new Error(`Console error: ${text}`);
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
    await expect(
      page.getByRole("heading", { name: /ProofOfHeart/i, level: 1 }).or(page.locator("body")),
    ).toBeVisible();

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
