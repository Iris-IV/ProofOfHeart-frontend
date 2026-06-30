import { test, expect } from "@playwright/test";

/**
 * E2E tests for critical user journeys:
 * 1. Connect Wallet
 * 2. Contribute to a campaign
 * 3. Vote on a campaign
 *
 * These tests run in mock mode (NEXT_PUBLIC_USE_MOCKS=true) for determinism.
 */
test.describe("Critical User Journeys", () => {
  test.beforeEach(async ({ page }) => {
    // Ensure we are in mock mode
    await page.goto("/");
  });

  test("should connect wallet successfully", async ({ page }) => {
    const connectButton = page.getByRole("button", { name: /Connect Wallet/i }).first();
    await expect(connectButton).toBeVisible();

    await connectButton.click();

    // In mock mode, it should immediately show as connected
    await expect(page.getByText(/Connected/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Disconnect/i })).toBeVisible();
  });

  test("should contribute to a verified campaign", async ({ page }) => {
    // 1. Connect wallet
    await page
      .getByRole("button", { name: /Connect Wallet/i })
      .first()
      .click();

    // 2. Go to Causes page
    await page.goto("/causes");

    // 3. Find a verified campaign (ID 1 in mock is verified)
    await page.locator('a[href*="/causes/1"]').first().click();
    await page.waitForURL(/\/causes\/1/);

    // 4. Click "Donate"
    const donateButton = page.getByRole("button", { name: /Donate/i }).first();
    await expect(donateButton).toBeVisible();
    await donateButton.click();

    // 5. Enter amount
    const amountInput = page.getByPlaceholder(/e\.g\. 10/i);
    await amountInput.fill("50");

    // 6. Submit donation
    await page.getByRole("button", { name: /Donate 50 XLM/i }).click();

    // 7. Verify success message
    await expect(page.getByText(/donated successfully/i)).toBeVisible();
  });

  test("should vote on an active campaign", async ({ page }) => {
    // 1. Connect wallet
    await page
      .getByRole("button", { name: /Connect Wallet/i })
      .first()
      .click();

    // 2. Go to an active campaign (ID 2 is active)
    await page.goto("/causes/2");

    // 3. Find Vote buttons
    const approveButton = page.getByRole("button", { name: /Approve/i }).first();
    await expect(approveButton).toBeVisible();

    await approveButton.click();

    // 4. Verify vote processed
    await expect(page.getByText(/You voted to approve/i)).toBeVisible();
  });
});
