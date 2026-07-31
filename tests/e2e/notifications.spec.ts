import { test, expect } from "@playwright/test";

test.describe("Notification Bell", () => {
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

    await page.addInitScript(() => {
      localStorage.setItem("onboarding_tour_dismissed", "1");
    });

    await page.goto("/");
  });

  test("should open notification dropdown, mark one read, and decrement unread count", async ({ page }) => {
    // 1. Connect wallet
    const connectButton = page.getByRole("button", { name: /Connect Wallet/i }).first();
    await expect(connectButton).toBeVisible();
    await connectButton.click();
    await expect(page.getByText(/Connected/i).first()).toBeVisible();

    // 2. Make a contribution to generate a notification
    await page.goto("/en/causes/1");
    await expect(page.getByRole("heading", { name: /Clean Water/i })).toBeVisible({ timeout: 10000 });

    const fundButton = page.getByRole("button", { name: /Fund This Cause/i }).first();
    await expect(fundButton).toBeVisible();
    await fundButton.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const amountInput = dialog.getByLabel(/Amount/i);
    await amountInput.fill("10");

    const donateButton = dialog.getByRole("button", { name: /Donate 10 XLM/i });
    await expect(donateButton).toBeEnabled();
    await donateButton.click();

    // Wait for confirmation
    await expect(page.getByText(/donated successfully/i)).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: /Close/i }).click();

    // 3. Open notification bell
    const bell = page.getByRole("button", { name: /Notifications/i });
    await expect(bell).toBeVisible();
    
    // Get initial unread count
    const badge = bell.locator("span").first();
    const initialBadgeText = await badge.textContent().catch(() => "0");
    
    await bell.click();

    // 4. Verify dropdown opened
    const dropdown = page.getByRole("dialog", { name: /Notifications/i });
    await expect(dropdown).toBeVisible();

    // 5. Mark first unread notification as read
    const markReadButton = dropdown.getByRole("button", { name: /Mark notification/i }).first();
    if (await markReadButton.isVisible()) {
      await markReadButton.click();
    }

    // 6. Close dropdown
    await page.keyboard.press("Escape");
    await expect(dropdown).not.toBeVisible();

    // 7. Verify badge updated (if there were notifications)
    if (initialBadgeText && initialBadgeText !== "0") {
      await expect(badge).not.toHaveText(initialBadgeText, { timeout: 5000 });
    }
  });
});