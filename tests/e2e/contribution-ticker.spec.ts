import { test, expect } from "@playwright/test";

for (const width of [320, 768, 1280]) {
  test(`the community feed fits a ${width}px viewport and explains demo mode`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem("onboarding_tour_dismissed", "1"));
    await page.goto("/en/causes/1");
    const feed = page.getByRole("region", { name: "Community contributions", exact: true });
    await expect(feed).toBeVisible();
    await expect(feed.getByRole("status")).toContainText("demo mode");
    const bounds = await feed.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await feed.getByRole("button", { name: "Pause feed", exact: true }).click();
    await expect(feed.getByRole("button", { name: "Resume feed", exact: true }))
      .toHaveAttribute("aria-pressed", "true");
  });
}
