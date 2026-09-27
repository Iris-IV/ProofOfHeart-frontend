import { test, expect } from "@playwright/test";

test.describe("Visual Regression Pipeline", () => {
  test("home landing page visual snapshot", async ({ page }) => {
    await page.goto("/en");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("landing-page.png", {
      fullPage: true,
      mask: [page.locator('[data-testid="live-timer"]')],
    });
  });

  test("causes list page visual snapshot", async ({ page }) => {
    await page.goto("/en/causes");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("causes-list-page.png", {
      fullPage: true,
    });
  });

  test("create cause page visual snapshot", async ({ page }) => {
    await page.goto("/en/causes/new");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("new-cause-page.png", {
      fullPage: true,
    });
  });
});
