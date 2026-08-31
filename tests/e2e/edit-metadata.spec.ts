import { test, expect } from "@playwright/test";

test.describe("Edit Campaign Metadata", () => {
  test.beforeEach(async ({ page }) => {
    // Safer pageerror handler — only throw on critical errors, log the rest
    page.on("pageerror", (err) => {
      const msg = err.message || "";
      const ignored = [
        "ChunkLoadError",
        "Load failed",
        "access control checks",
        "ResizeObserver loop limit exceeded",
        "ResizeObserver loop completed",
        "MISSING_MESSAGE",
        "Could not resolve",
      ];
      if (ignored.some((s) => msg.includes(s))) return;

      // Only throw for truly critical runtime exceptions
      const critical = ["ReferenceError", "TypeError", "UnhandledPromiseRejection"];
      if (critical.some((s) => msg.includes(s))) {
        throw new Error(`Uncaught page error: ${msg}`);
      }

      // Non-fatal — log and continue to avoid intermittent CI failures
      console.warn("Non-fatal page error ignored in test:", msg);
    });

    // Dismiss the onboarding tour and pre-seed wallet connection state
    // so the UI skips the wallet modal and treats the user as connected.
    await page.addInitScript(() => {
      localStorage.setItem("onboarding_tour_dismissed", "1");
      localStorage.setItem(
        "stellar_wallet_public_key",
        "GCREATOR1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123",
      );
    });

    // Navigate to home; locale redirect settles here
    await page.goto("/");

    // 1. Create a new campaign through the UI (so we are the creator and can edit)
    await page.goto("/en/causes/new");

    // Use a unique title so concurrent tests don't clash on the dashboard
    const uniqueTitle = `My E2E Cause ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await page.getByLabel(/Campaign Title/i).fill(uniqueTitle);
    await page.getByLabel(/Description/i).fill("Original description for this cause.");
    await page.getByLabel(/Funding Goal/i).fill("1000");
    await page.getByLabel(/Duration/i).fill("15");

    // Proceed to review step
    await page.getByRole("button", { name: /Review Details/i }).click();
    await expect(page.getByText(/Review Your Cause/i)).toBeVisible({ timeout: 30000 });

    // Guard the Confirm & Create click — wait for button to be enabled, then
    // race the click with a navigation wait to avoid post-click race conditions.
    const confirmButton = page.getByRole("button", { name: /Confirm & Sign/i });
    await expect(confirmButton).toBeVisible({ timeout: 30000 });
    await expect(confirmButton).toBeEnabled({ timeout: 30000 });

    await confirmButton.click();

    // Wait for creation success indicator
    await expect(page.getByText(/created successfully/i).first()).toBeVisible({ timeout: 30000 });

    // The app automatically redirects to the Cause Detail page (/causes/[id]).
    // Wait for Cause Detail page to load with the edit button
    await expect(page.getByRole("button", { name: /Edit metadata/i })).toBeVisible({
      timeout: 30000,
    });
  });

  test("should block invalid image URL", async ({ page }) => {
    const editButton = page.getByRole("button", { name: /Edit metadata/i });
    await editButton.click();

    const editPanel = page.getByTestId("edit-metadata-panel");
    await expect(editPanel).toBeVisible({ timeout: 30000 });

    // Fill with an invalid (HTTP, not HTTPS) image URL
    const coverImageInput = editPanel.getByLabel(/Cover Image URL/i);
    await coverImageInput.fill("http://invalid-url.com/image.png");

    const saveButton = editPanel.getByRole("button", { name: /Save/i });
    await saveButton.click();

    // Validation error must appear scoped inside the panel
    await expect(
      editPanel.getByText(/Image domain not allowed|Image URL must use HTTPS/i),
    ).toBeVisible({ timeout: 5000 });
  });

  test("should successfully edit description", async ({ page }) => {
    const editButton = page.getByRole("button", { name: /Edit metadata/i });
    await editButton.click();

    const editPanel = page.getByTestId("edit-metadata-panel");
    await expect(editPanel).toBeVisible({ timeout: 30000 });

    // Use a known-good HTTPS URL accepted by most domain-allowlist configs
    const coverImageInput = editPanel.getByLabel(/Cover Image URL/i);
    await coverImageInput.fill("https://via.placeholder.com/600x400.png");

    // Update description inside the scoped edit panel
    const metadataDescription = editPanel.getByLabel(/Description/i);
    await metadataDescription.fill("Updated description for this cause.");

    const saveButton = editPanel.getByRole("button", { name: /Save/i });
    await saveButton.click();

    // Wait for the panel to close after a successful save, then check the page
    await expect(editPanel).toBeHidden({ timeout: 30000 });
    await expect(page.getByText(/Updated description for this cause\./i)).toBeVisible({
      timeout: 30000,
    });
  });
});
