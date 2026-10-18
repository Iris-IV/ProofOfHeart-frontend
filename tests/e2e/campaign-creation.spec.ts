import { test, expect } from "@playwright/test";

/**
 * End-to-end tests for complete campaign draft creation and publication flow.
 * Tests simulate real user interactions with mock data to ensure reliability.
 */

test.describe("Campaign Creation E2E Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to campaign creation page
    await page.goto("/en/causes/new");
    // Wait for page to fully load
    await page.waitForLoadState("networkidle");
  });

  test("should render campaign creation form", async ({ page }) => {
    // Verify page heading
    await expect(page.locator("h1")).toContainText("Create a Campaign");

    // Verify all required form fields are present
    await expect(page.locator("label")).toContainText("Campaign Title");
    await expect(page.locator("label")).toContainText("Description");
    await expect(page.locator("label")).toContainText("Funding Goal");
    await expect(page.locator("label")).toContainText("Duration");
    await expect(page.locator("label")).toContainText("Category");
  });

  test("should complete basic campaign creation without wallet", async ({ page }) => {
    // Fill form fields
    await page.fill('input[name="title"]', "Community Garden Initiative");
    await page.fill('textarea[name="description"]', "Creating a sustainable community garden for local residents.");
    await page.fill('input[name="fundingGoal"]', "500");
    await page.fill('input[name="duration"]', "60");

    // Select category
    await page.selectOption('select[name="category"]', "0");

    // Attempt submission (should be disabled without wallet)
    const submitButton = page.locator('button:has-text("Launch Campaign")');
    await expect(submitButton).toBeDisabled();
  });

  test("should validate required fields", async ({ page }) => {
    // Try to submit without filling any fields
    await page.click('button:has-text("Launch Campaign")');

    // Wait for validation errors
    await expect(page.locator("text=Title is required")).toBeVisible();
    await expect(page.locator("text=Description is required")).toBeVisible();
  });

  test("should show wallet guard when disconnected", async ({ page }) => {
    // Verify wallet guard message appears
    await expect(page.locator("text=Connect your Freighter wallet")).toBeVisible();

    // Verify connect wallet button is present
    const connectBtn = page.locator('button:has-text("Connect Wallet")');
    await expect(connectBtn).toBeVisible();
  });

  test("should handle form submission with valid data", async ({ page }) => {
    // Fill all required fields
    await page.fill('input[name="title"]', "Tech Workshop Series");
    await page.fill('textarea[name="description"]', "Monthly workshops on emerging technologies for students and professionals.");
    await page.fill('input[name="fundingGoal"]', "1000");
    await page.fill('input[name="duration"]', "30");
    await page.selectOption('select[name="category"]', "1"); // Educational Startup

    // Verify character counters update
    await expect(page.locator("text=/\d+\/100/")).toBeVisible(); // Title counter
    await expect(page.locator("text=/\d+\/1,000/")).toBeVisible(); // Description counter
  });

  test("should validate funding goal constraints", async ({ page }) => {
    await page.fill('input[name="title"]', "Valid Title");
    await page.fill('textarea[name="description"]', "Valid description here.");
    await page.fill('input[name="fundingGoal"]', "0");
    await page.fill('input[name="duration"]', "30");

    await page.click('button:has-text("Launch Campaign")');

    // Should show funding goal error
    await expect(page.locator("text=Funding goal must be greater than 0")).toBeVisible();
  });

  test("should validate duration constraints", async ({ page }) => {
    await page.fill('input[name="title"]', "Valid Title");
    await page.fill('textarea[name="description"]', "Valid description here.");
    await page.fill('input[name="fundingGoal"]', "500");
    await page.fill('input[name="duration"]', "400");

    await page.click('button:has-text("Launch Campaign")');

    // Should show duration error
    await expect(page.locator("text=Duration must be between 1 and 365 days")).toBeVisible();
  });

  test("should show revenue sharing options for startup category", async ({ page }) => {
    // Select Educational Startup category
    await page.selectOption('select[name="category"]', "1");

    // Verify revenue sharing section appears
    await expect(page.locator("text=Revenue Sharing")).toBeVisible();
    await expect(page.locator("role=switch")).toBeVisible();
  });

  test("should not show revenue sharing for non-startup categories", async ({ page }) => {
    // Default category is Learner (0)
    await expect(page.locator("role=switch")).not.toBeVisible();
  });

  test("should toggle revenue sharing slider", async ({ page }) => {
    // Select Educational Startup
    await page.selectOption('select[name="category"]', "1");

    // Toggle revenue sharing on
    await page.click("role=switch");

    // Verify slider appears
    await expect(page.locator('input[name="revenueSharePercentage"]')).toBeVisible();
  });

  test("should update revenue share percentage display", async ({ page }) => {
    await page.selectOption('select[name="category"]', "1");
    await page.click("role=switch");

    // Set revenue share to 15%
    await page.fill('input[name="revenueSharePercentage"]', "15");

    // Verify percentage is displayed
    await expect(page.locator("text=15.00%")).toBeVisible();
  });

  test("should handle optional creator email", async ({ page }) => {
    await page.fill('input[name="title"]', "Valid Title");
    await page.fill('textarea[name="description"]', "Valid description.");
    await page.fill('input[name="fundingGoal"]', "500");
    await page.fill('input[name="duration"]', "30");

    // Fill optional email
    await page.fill('input[name="creatorEmail"]', "creator@example.com");

    // Should not show error for valid email
    const submitButton = page.locator('button:has-text("Launch Campaign")');
    await expect(submitButton).not.toBeDisabled();
  });

  test("should validate email format", async ({ page }) => {
    await page.fill('input[name="title"]', "Valid Title");
    await page.fill('textarea[name="description"]', "Valid description.");
    await page.fill('input[name="fundingGoal"]', "500");
    await page.fill('input[name="duration"]', "30");
    await page.fill('input[name="creatorEmail"]', "invalid-email");

    await page.click('button:has-text("Launch Campaign")');

    // Should show email validation error
    await expect(page.locator("text=Enter a valid email address")).toBeVisible();
  });
});
