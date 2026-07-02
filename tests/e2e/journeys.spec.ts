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
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForLoadState("domcontentloaded");
    // Dismiss the onboarding tour so it doesn't intercept pointer events
    await page.addInitScript(() => {
      localStorage.setItem("onboarding_tour_dismissed", "1");
    });
    // Ensure we are in mock mode; wait for the locale redirect to settle
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("should connect wallet successfully", async ({ page }) => {
    const connectButton = page.getByRole("button", { name: /Connect Wallet/i }).first();
    await expect(connectButton).toBeVisible({ timeout: 10000 });

    await connectButton.click();

    // In mock mode, it should immediately show as connected
    await page.waitForTimeout(500);
    await expect(page.getByText(/Connected/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /Disconnect/i })).toBeVisible({ timeout: 10000 });
  });

  test("should contribute to a verified campaign", async ({ page }) => {
    // 1. Connect wallet
    await page
      .getByRole("button", { name: /Connect Wallet/i })
      .first()
      .click();

    await page.waitForTimeout(500);

    // 2. Go to Causes page
    await page.goto("/causes", { waitUntil: "networkidle" });
    await page.waitForLoadState("domcontentloaded");

    // 3. Find a verified campaign (ID 1 in mock is verified)
    await page.locator('a[href*="/causes/1"]').first().click();
    await page.waitForURL(/\/causes\/1/);
    await page.waitForLoadState("domcontentloaded");

    // 4. Click "Donate"
    const donateButton = page.getByRole("button", { name: /Donate/i }).first();
    await expect(donateButton).toBeVisible({ timeout: 10000 });
    await donateButton.click();

    // 5. Enter amount
    const amountInput = page.getByPlaceholder(/e\.g\. 10/i);
    await amountInput.fill("50");

    // 6. Submit donation
    await page.getByRole("button", { name: /Donate 50 XLM/i }).click();

    // 7. Verify success message
    await expect(page.getByText(/donated successfully/i)).toBeVisible({ timeout: 10000 });
    // 2. Navigate directly to a verified campaign detail page (campaign 1 is verified in mock)
    await page.goto("/en/causes/1");
    await page.waitForLoadState("networkidle");

    // 3. Wait for campaign to finish loading (skeleton → detail)
    await expect(page.getByRole("heading", { name: /Clean Water/i })).toBeVisible({
      timeout: 10000,
    });

    // 4. Click "Fund This Cause"
    const fundButton = page.getByRole("button", { name: /Fund This Cause/i }).first();
    await expect(fundButton).toBeVisible();
    await fundButton.click();

    // 5. Verify donation modal opened
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("should vote on an active campaign", async ({ page }) => {
    // 1. Connect wallet
    await page
      .getByRole("button", { name: /Connect Wallet/i })
      .first()
      .click();

    await page.waitForTimeout(500);

    // 2. Go to an active campaign (ID 2 is active)
    await page.goto("/causes/2", { waitUntil: "networkidle" });
    await page.waitForLoadState("domcontentloaded");

    // 3. Find Vote buttons
    const approveButton = page.getByRole("button", { name: /Approve/i }).first();
    await expect(approveButton).toBeVisible({ timeout: 10000 });

    await approveButton.click();

    // 4. Verify vote processed
    await expect(page.getByText(/You voted to approve/i)).toBeVisible({ timeout: 10000 });
    // 2. Navigate to the causes list where VotingComponent is inline on each card
    await page.goto("/en/causes");
    await page.waitForLoadState("networkidle");

    // 3. Wait for campaigns to render
    await expect(page.getByText(/Education Technology/i).first()).toBeVisible({ timeout: 10000 });

    // 4. Find the Approve vote button on an active campaign card
    const approveButton = page.getByRole("button", { name: /Approve campaign/i }).first();
    await expect(approveButton).toBeVisible();

    await approveButton.click();

    // 5. Verify vote confirmation message appears
    await expect(page.getByText(/You voted to approve this cause/i)).toBeVisible({
      timeout: 10000,
    });
  });
});
