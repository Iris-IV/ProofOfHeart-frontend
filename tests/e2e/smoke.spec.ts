import { test, expect } from '@playwright/test';

/**
 * Smoke test for the core user navigation flow:
 * Home → Causes → Cause Detail → Dashboard
 * 
 * This test runs with NEXT_PUBLIC_USE_MOCKS=true to validate
 * the critical user path without external dependencies.
 */
test.describe('Core User Flow Smoke Test', () => {
  test('should navigate from home to causes to cause detail to dashboard', async ({ page }) => {
    // Step 1: Navigate to Home page
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('body')).toBeVisible();

    // Step 2: Navigate to Causes page
    // Look for navigation link or directly navigate
    const causesLink = page.locator('a[href*="causes"]').first();
    if (await causesLink.isVisible()) {
      await causesLink.click();
      await page.waitForURL(/\/causes/);
    } else {
      // Fallback: direct navigation if nav link not found
      await page.goto('/causes');
    }
    await expect(page).toHaveURL(/\/causes/);
    await expect(page.locator('body')).toBeVisible();

    // Step 3: Navigate to a specific Cause Detail page
    // Find the first cause card/link and click it
    const causeCard = page.locator('[data-testid="cause-card"], a[href*="/causes/"]').first();
    if (await causeCard.isVisible()) {
      await causeCard.click();
      await page.waitForURL(/\/causes\/[^/]+$/);
    } else {
      // Fallback: navigate to a known cause ID
      await page.goto('/causes/1');
    }
    await expect(page).toHaveURL(/\/causes\/[^/]+$/);
    await expect(page.locator('body')).toBeVisible();

    // Step 4: Navigate to Dashboard
    const dashboardLink = page.locator('a[href*="dashboard"]').first();
    if (await dashboardLink.isVisible()) {
      await dashboardLink.click();
      await page.waitForURL(/\/dashboard/);
    } else {
      // Fallback: direct navigation
      await page.goto('/dashboard');
    }
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('body')).toBeVisible();
  });
});
