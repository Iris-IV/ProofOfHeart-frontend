import { test, expect } from "@playwright/test";

test.describe("Notification Bell", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("onboarding_tour_dismissed", "1");
    });

    await page.goto("/");
  });

  test("should open notification dropdown, mark one read, and decrement unread count", async ({ page }) => {
    const connectButton = page.getByRole("button", { name: /Connect Wallet/i }).first();
    await expect(connectButton).toBeVisible();
    await connectButton.click();
    await expect(page.getByText(/Connected/i).first()).toBeVisible();

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
    await donateButton.scrollIntoViewIfNeeded();
    await donateButton.click();

    await expect(page.getByText(/donated successfully/i)).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: /Close/i }).click();

    const bell = page.getByRole("button", { name: /Notifications/ });
    await expect(bell).toBeVisible();
    const badge = bell.getByText(/\d+/);
    await expect(badge).toBeVisible();
    const initialCount = await badge.textContent();

    await bell.click();
    const dropdown = page.getByRole("dialog", { name: /Notifications/i });
    await expect(dropdown).toBeVisible();

    const markReadButton = dropdown.getByRole("button", { name: /Mark notification/i }).first();
    await expect(markReadButton).toBeVisible();
    await markReadButton.click();

    await page.keyboard.press("Escape");
    await expect(dropdown).not.toBeVisible();

    await expect(badge).not.toHaveText(initialCount ?? "", { timeout: 5000 });
  });
});