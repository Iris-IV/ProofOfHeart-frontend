import { test, expect } from "@playwright/test";

/**
 * Critical user journey tests.
 *
 * These run with NEXT_PUBLIC_USE_MOCKS=true (no Freighter extension required).
 * Mock wallet connect sets a random Stellar keypair in localStorage and
 * immediately shows the wallet address in the navbar.
 *
 * Complex on-chain flows (donate, vote, withdraw) require wallet signing in
 * production but return immediately in mock mode. We keep those assertions
 * lightweight — we test that the UI renders the correct widgets and accepts
 * user input, not that a real transaction was submitted.
 */
test.describe("Critical User Journeys", () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss the onboarding tour so it doesn't intercept pointer events
    await page.addInitScript(() => {
      localStorage.setItem("onboarding_tour_dismissed", "1");
    });
    // Ensure we are in mock mode; wait for the locale redirect to settle
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

test.describe("Journey — wallet connect", () => {
  test("connects mock wallet from the navbar", async ({ page }) => {
    await page.goto("/en");

    // Before connect: the "Connect Wallet" button is visible
    const connectBtn = page.locator("button", { hasText: /Connect Wallet/i }).first();
    await expect(connectBtn).toBeVisible();

    await connectBtn.click();

    // After connect: button disappears and a wallet address is shown
    // (formatAddress truncates to e.g. "GABC…XYZ")
    await expect(connectBtn).not.toBeVisible({ timeout: 10000 });

    // The navbar now shows a truncated address (contains "…")
    const addressBadge = page.locator("nav").getByText(/\w{4,}…\w{4,}/);
    await expect(addressBadge).toBeVisible();
  });

  test("disconnect wallet removes the address from the navbar", async ({ page }) => {
    await page.goto("/en");

    // Connect first
    await page
      .locator("button", { hasText: /Connect Wallet/i })
      .first()
      .click();
    const addressBadge = page.locator("nav").getByText(/\w{4,}…\w{4,}/);
    await expect(addressBadge).toBeVisible({ timeout: 10000 });

    // Find the disconnect button (aria-label="Disconnect")
    const disconnectBtn = page.locator(
      'button[aria-label="Disconnect"], button[title="Disconnect"]',
    );
    await expect(disconnectBtn).toBeVisible();
    await disconnectBtn.click();

    // Address badge is gone and Connect Wallet button is back
    await expect(addressBadge).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator("button", { hasText: /Connect Wallet/i }).first()).toBeVisible();
  });
});

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

  test("search filter narrows visible campaigns", async ({ page }) => {
    await page.goto("/en/causes");

    const searchInput = page
      .getByRole("searchbox")
      .or(page.locator('input[type="search"], input[placeholder*="search" i]'))
      .first();
    await expect(searchInput).toBeVisible({ timeout: 15000 });

    // 2. Navigate to the causes list where VotingComponent is inline on each card
    await page.goto("/en/causes");
    await page.waitForLoadState("networkidle");

    // 3. Wait for campaigns to render
    await expect(page.getByText(/Education Technology/i).first()).toBeVisible({ timeout: 10000 });

    // 4. Find the Approve vote button on an active campaign card
    const approveButton = page.getByRole("button", { name: /Approve campaign/i }).first();
    await expect(approveButton).toBeVisible();

test.describe("Journey — contribute widget (mock mode)", () => {
  test("cause detail shows connect-wallet CTA when wallet is not connected", async ({ page }) => {
    await page.goto("/en/causes/1");

    // Without a wallet, CampaignActions shows a connect prompt
    await expect(
      page
        .getByText(/Connect your wallet to interact with this campaign/i)
        .or(page.getByText(/Connect Wallet to Contribute/i)),
    ).toBeVisible({ timeout: 15000 });
  });

    // 5. Verify vote confirmation message appears
    await expect(page.getByText(/You voted to approve this cause/i)).toBeVisible({
      timeout: 10000,
    });
  });
});
