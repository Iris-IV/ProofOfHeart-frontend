import { test, expect } from "./fixtures";

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
    await page.goto("/");
    const onboardingDialog = page.getByRole('dialog');
    if (await onboardingDialog.isVisible().catch(() => false)) {
      const closeBtn = page.getByRole('button', { name: /skip|close|✕/i }).first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await onboardingDialog.waitFor({ state: 'hidden' });
      }
    }
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

    // 2. Go to a verified campaign (ID 1 in mock is verified)
    await page.goto("/en/causes/1");
    await expect(page.getByRole("heading", { name: /Clean Water/i })).toBeVisible();

    // 3. Click "Donate"
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
    await page.goto("/en/causes/2");
    await expect(page.getByRole("heading", { name: /Education Technology/i })).toBeVisible();

    // 3. Find Vote buttons
    const approveButton = page.getByRole("button", { name: /Approve/i }).first();
    await expect(approveButton).toBeVisible();

    await approveButton.click();

    // 4. Verify vote processed
    await expect(page.getByText(/You voted to approve/i)).toBeVisible();
  });
});
