import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
const baseURL = process.env.BASE_URL || "http://localhost:3000";

/**
 * Playwright E2E configuration for ProofOfHeart frontend.
 *
 * - Tests run with NEXT_PUBLIC_USE_MOCKS=true to use mock data
 * - CI mode: headless, no traces on success
 * - Local mode: headed with retries disabled for faster feedback
 * - Visual regression testing enabled with configurable thresholds
 * - Comprehensive logging and error reporting for CI pipelines
 * - CI uses a stable, low-noise browser matrix and keeps artifacts focused on failures
 * - Local runs stay lightweight and fast while still using mock data for deterministic UI tests
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 4 : undefined,
  maxFailures: isCI ? 5 : undefined,
  reporter: isCI ? [["github"], ["list"], ["html"], ["junit"]] : [["list"]],
  outputDir: "./test-results",

  expect: {
    timeout: 10000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.05,
      threshold: 0.2,
      animations: "disabled",
    },
  },

  use: {
    baseURL,
    headless: isCI,
    trace: isCI ? "on-first-retry" : "retain-on-failure",
    screenshot: "only-on-failure",
    video: isCI ? "retain-on-failure" : "off",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    viewport: { width: 1280, height: 720 },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    ...(isCI
      ? [
          {
            name: "firefox",
            use: { ...devices["Desktop Firefox"] },
          },
          {
            name: "webkit",
            use: { ...devices["Desktop Safari"] },
          },
        ]
      : []),
  ],

  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      NEXT_PUBLIC_USE_MOCKS: "true",
    },
  },
});
