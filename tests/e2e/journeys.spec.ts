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
    // Ensure we are in mock mode; wait for the locale redirect to settle
    await page.goto("/");
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
    const connectButton = page.getByRole("button", { name: /Connect Wallet/i }).first();
    await expect(connectButton).toBeVisible({ timeout: 10000 });
    await connectButton.click();
    await page.waitForTimeout(500);

    // 2. Navigate directly to a verified campaign detail page (campaign 1 is verified in mock)
    await page.goto("/en/causes/1");
    await page.waitForLoadState("domcontentloaded");

    // 3. Wait for campaign detail to finish loading
    await expect(page.getByRole("heading", { name: /Clean Water/i })).toBeVisible({
      timeout: 10000,
    });

    // 4. Click "Fund This Cause"
    const fundButton = page.getByRole("button", { name: /Fund This Cause/i }).first();
    await expect(fundButton).toBeVisible({ timeout: 10000 });
    await fundButton.click();

    // 5. Verify donation modal opened
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });

    // 6. Enter amount
    const amountInput = page.locator("#donation-amount");
    await amountInput.fill("50");

    // 7. Submit donation
    await page.getByRole("button", { name: /Donate 50 XLM/i }).click();

    // 8. Verify success step
    await expect(page.getByText(/successfully donated|thank you/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("should vote on an active campaign", async ({ page }) => {
    // 1. Connect wallet
    const connectButton = page.getByRole("button", { name: /Connect Wallet/i }).first();
    await expect(connectButton).toBeVisible({ timeout: 10000 });
    await connectButton.click();
    await page.waitForTimeout(500);

    // 2. Go to an active campaign detail page (ID 2 is active)
    await page.goto("/en/causes/2", { waitUntil: "networkidle" });
    await page.waitForLoadState("domcontentloaded");

    // 3. Find Approve button
    const approveButton = page.getByRole("button", { name: /Approve/i }).first();
    await expect(approveButton).toBeVisible({ timeout: 10000 });
    await approveButton.click();

    // 4. Verify vote processed
    await expect(page.getByText(/You voted to approve/i)).toBeVisible({ timeout: 10000 });
  });
});
