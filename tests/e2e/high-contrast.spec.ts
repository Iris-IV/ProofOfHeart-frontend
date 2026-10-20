import { test, expect } from "@playwright/test";

for (const width of [320, 768, 1280]) {
  test(`high contrast persists and has legible controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem("onboarding_tour_dismissed", "1"));
    await page.goto("/en/causes");
    if (width < 768) await page.getByRole("button", { name: "Toggle menu" }).click();
    await page.getByRole("button", { name: "High contrast", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
    const search = page.getByRole("searchbox");
    await expect(search).toBeVisible();
    const colors = await search.evaluate((element) => {
      const style = getComputedStyle(element);
      return { text: style.color, surface: style.backgroundColor, border: style.borderTopWidth };
    });
    expect(colors).toEqual({ text: "rgb(0, 0, 0)", surface: "rgb(255, 255, 255)", border: "2px" });
    await search.focus();
    expect(await search.evaluate((element) => getComputedStyle(element).outlineWidth)).toBe("3px");
  });
}
