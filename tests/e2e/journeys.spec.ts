import { test, expect } from "@playwright/test";

/**
 * E2E tests for critical user journeys:
 * 1. Connect Wallet
 * 2. Contribute to a campaign
 * 3. Vote on a campaign
 *
 * These tests run in mock mode (NEXT_PUBLIC_USE_MOCKS=true) for determinism.
 *
 * Note: The app uses next-intl for i18n routing, so all pages are served
 * under a locale prefix (e.g. /en/causes). Direct navigation uses /en/ prefix
 * and URL assertions use patterns that match both /en/ and /es/ locales.
 */
test.describe("Critical User Journeys", () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss the onboarding tour on every page load so it never blocks clicks.
    // The tour is shown when "onboarding_tour_dismissed" is absent from localStorage.
    await page.addInitScript(() => {
      localStorage.setItem("onboarding_tour_dismissed", "1");
    });

    // Start on the home page; middleware redirects / → /<locale>
    await page.goto("/");
    await page.waitForURL(/\/(en|es)(\/)?$/);
  });

  test("should connect wallet successfully", async ({ page }) => {
    // The "Connect Wallet" button is in the desktop nav (hidden md:flex).
    // Playwright's default viewport (1280x720) is wide enough to see it.
    const connectButton = page
      .getByRole("button", { name: /Connect Wallet/i })
      .first();
    await expect(connectButton).toBeVisible();

    await connectButton.click();

    // In mock mode, connecting is synchronous. The nav shows a small
    // "Connected" label above the truncated public key and a disconnect
    // icon button with aria-label="Disconnect".
    await expect(page.getByText("Connected").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Disconnect/i }),
    ).toBeVisible();
  });

  test("should contribute to an active campaign", async ({ page }) => {
    // 1. Connect wallet first
    await page
      .getByRole("button", { name: /Connect Wallet/i })
      .first()
      .click();
    // Wait until wallet is shown as connected
    await expect(page.getByText("Connected").first()).toBeVisible();

    // 2. Navigate to the Causes page (mock campaign id=1 is active & verified)
    await page.goto("/en/causes");
    await expect(page).toHaveURL(/\/(en|es)\/causes/);

    // 3. Navigate to campaign detail (id 1)
    await page.goto("/en/causes/1");
    await expect(page).toHaveURL(/\/(en|es)\/causes\/1$/);

    // 4. Click "Fund This Cause" — this is the donate trigger button on the detail page
    //    (shown when campaign.is_active && !campaign.is_cancelled)
    const fundButton = page
      .getByRole("button", { name: /Fund This Cause/i })
      .first();
    await expect(fundButton).toBeVisible();
    await fundButton.click();

    // 5. The DonationModal should be open; fill in the amount via its label
    const amountInput = page.getByLabel(/Amount/i);
    await expect(amountInput).toBeVisible();
    await amountInput.fill("50");

    // 6. Submit the donation — button reads "Donate 50 XLM" once amount is entered
    const donateSubmitButton = page.getByRole("button", {
      name: /Donate 50 XLM/i,
    });
    await expect(donateSubmitButton).toBeVisible();
    await donateSubmitButton.click();

    // 7. Verify success message shown in the confirmed step of the modal
    //    DonationModal key "donatedSuccess": "{amount} XLM donated successfully"
    await expect(
      page.getByText(/donated successfully/i).first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test("should vote on an active campaign", async ({ page }) => {
    // 1. Connect wallet first so userWalletAddress is set in VotingComponent
    await page
      .getByRole("button", { name: /Connect Wallet/i })
      .first()
      .click();
    await expect(page.getByText("Connected").first()).toBeVisible();

    // 2. Navigate to campaign 2 (is_active: true, is_verified: false — valid for voting)
    await page.goto("/en/causes/2");
    await expect(page).toHaveURL(/\/(en|es)\/causes\/2$/);

    // 3. Find and click the Approve vote button
    //    aria-label="Approve campaign", visible text t("approve") = "Approve"
    const approveButton = page
      .getByRole("button", { name: /Approve/i })
      .first();
    await expect(approveButton).toBeVisible();
    await approveButton.click();

    // 4. Verify the "voted" confirmation text appears in the VotingComponent
    //    t("votedUpvote") = "You voted to approve this cause"
    await expect(
      page.getByText(/You voted to approve this cause/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});
