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

test.describe("Journey — cause browsing", () => {
  test("causes list shows mock campaigns", async ({ page }) => {
    await page.goto("/en/causes");

    // All 6 mock campaigns should render (check 3 known titles)
    await expect(page.getByText("Clean Water for Rural Communities")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("Education Technology for Underprivileged Children")).toBeVisible();
    await expect(page.getByText("Medical Supplies for Remote Clinics")).toBeVisible();
  });

  test("clicking a cause card navigates to its detail page", async ({ page }) => {
    await page.goto("/en/causes");

    // The first visible cause card link should navigate to a detail URL
    const firstCard = page.locator('a[href*="/causes/"]').filter({ hasNotText: /new/i }).first();
    await expect(firstCard).toBeVisible({ timeout: 15000 });
    await firstCard.click();

    await expect(page).toHaveURL(/\/en\/causes\/\d+/, { timeout: 15000 });
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("cause detail page for campaign 1 shows funding progress", async ({ page }) => {
    await page.goto("/en/causes/1");

    await expect(page.getByText("Clean Water for Rural Communities")).toBeVisible({
      timeout: 15000,
    });
    // Funding progress: campaign 1 has 65,000 / 100,000 XLM raised
    // The progress bar or amount text should be visible
    await expect(
      page
        .locator('[role="progressbar"], [data-testid="progress"]')
        .or(page.getByText(/XLM/i).first()),
    ).toBeVisible();
  });

  test("search filter narrows visible campaigns", async ({ page }) => {
    await page.goto("/en/causes");

    const searchInput = page
      .getByRole("searchbox")
      .or(page.locator('input[type="search"], input[placeholder*="search" i]'))
      .first();
    await expect(searchInput).toBeVisible({ timeout: 15000 });

    await searchInput.fill("Clean Water");

    // Only the matching campaign should be visible; the others should be gone
    await expect(page.getByText("Clean Water for Rural Communities")).toBeVisible();
    await expect(
      page.getByText("Education Technology for Underprivileged Children"),
    ).not.toBeVisible({
      timeout: 5000,
    });
  });
});

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

  test("after connecting, cause detail shows contribute input", async ({ page }) => {
    await page.goto("/en/causes/1");

    // Connect wallet via the navbar button
    const connectBtn = page.locator("button", { hasText: /Connect Wallet/i }).first();
    await connectBtn.click();
    await expect(page.locator("nav").getByText(/\w{4,}…\w{4,}/)).toBeVisible({ timeout: 10000 });

    // Now the contribution form or amount input should be visible
    const contributeInput = page
      .locator(
        'input[type="number"], input[placeholder*="amount" i], input[placeholder*="XLM" i], input[placeholder*="0" i]',
      )
      .first();
    await expect(contributeInput).toBeVisible({ timeout: 10000 });
  });
});
