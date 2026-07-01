import { test, expect, localePath } from "./fixtures";

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
    await page.goto(localePath("/"));
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
    test.setTimeout(60_000);

    await page.goto(localePath("/causes/1"));
    await expect(
      page.getByRole("heading", { name: /Clean Water for Rural Communities/i }),
    ).toBeVisible({ timeout: 30_000 });

    await page
      .getByRole("button", { name: /Connect Wallet/i })
      .first()
      .click();
    await expect(page.getByRole("button", { name: /Disconnect/i })).toBeVisible();

    const fundButton = page.getByRole("button", { name: /Fund This Cause/i });
    await expect(fundButton).toBeVisible();
    await fundButton.click();

    const amountInput = page.getByPlaceholder(/e\.g\. 10/i);
    await amountInput.fill("50");

    await page.getByRole("button", { name: /Donate 50 XLM/i }).click();

    await expect(page.getByText(/donated successfully/i)).toBeVisible();
  });

  test("should vote on an active campaign", async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto(localePath("/causes/2"));
    await expect(
      page.getByRole("heading", { name: /Education Technology for Underprivileged Children/i }),
    ).toBeVisible({ timeout: 30_000 });

    await page
      .getByRole("button", { name: /Connect Wallet/i })
      .first()
      .click();
    await expect(page.getByRole("button", { name: /Disconnect/i })).toBeVisible();

    const approveButton = page.getByRole("button", { name: /Approve campaign/i });
    await expect(approveButton).toBeVisible();

    await approveButton.click();

    await expect(page.getByText(/You voted to approve/i)).toBeVisible();
  });
});
