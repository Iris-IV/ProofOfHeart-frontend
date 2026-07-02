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
    page.on("pageerror", (err) => {
      if (err.message.includes("ChunkLoadError") || err.message.includes("Load failed") || err.message.includes("access control checks")) {
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
    // Ensure we are in mock mode; wait for the locale redirect to settle
    await page.goto("/");
    await expect(page).toHaveURL(/\/(en|es)?\/?$/);
    await expect(page.locator("body")).toBeVisible();
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

    // 2. Navigate directly to a verified campaign detail page (campaign 1 is verified in mock)
    await page.goto("/en/causes/1");
    await expect(page).toHaveURL(/\/causes\/1$/);

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

    // 2. Navigate to the causes list where VotingComponent is inline on each card
    await page.goto("/en/causes");
    await expect(page).toHaveURL(/\/causes$/);

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
