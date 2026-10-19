import { test, expect } from "@playwright/test";

for (const width of [320, 768, 1280]) {
  test(`creator customization and contribution roadmap at ${width}px`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem("onboarding_tour_dismissed", "1");
      sessionStorage.setItem(
        "stellar_wallet_public_key",
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      );
    });

    await page.goto("/en/profile");
    const profile = page.getByRole("region", { name: "Creator profile" });
    await profile.getByRole("button", { name: "Customize profile" }).click();
    await profile.getByLabel("Display name").fill("Community School Builders");
    await profile.getByLabel("Website", { exact: true }).fill("https://example.org");
    await profile.getByRole("button", { name: "Save profile" }).click();
    await expect(profile.getByRole("status")).toContainText("saved in this browser");
    await page.reload();
    await expect(profile.getByRole("heading", { name: "Community School Builders" })).toBeVisible();
    await expect(profile.getByRole("link", { name: /Website/ })).toHaveAttribute(
      "href",
      "https://example.org",
    );
    await expect(profile).toHaveJSProperty(
      "scrollWidth",
      await profile.evaluate((node) => node.clientWidth),
    );
    await profile.screenshot({ path: testInfo.outputPath(`profile-${width}.png`) });

    await page.goto("/en/causes/1");
    const roadmap = page.getByRole("region", { name: "Fundraising milestones" });
    await expect(roadmap.getByRole("listitem")).toHaveCount(5);
    await expect(roadmap.locator('[aria-current="step"]')).toContainText("Legendary Heart");
    const firstMilestone = roadmap.locator("summary").first();
    await firstMilestone.click();
    await expect(roadmap.getByRole("progressbar", { name: "First Spark" })).toBeVisible();
    await roadmap.screenshot({ path: testInfo.outputPath(`roadmap-${width}.png`) });

    const trigger = page.getByRole("button", { name: /Fund This Cause/ }).first();
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Amount (XLM)", { exact: true })).toBeFocused();
    await dialog.getByRole("button", { name: "10 XLM", exact: true }).click();
    await expect(dialog.getByLabel("Amount (XLM)", { exact: true })).toHaveValue("10");
    const submit = dialog.getByRole("button", { name: "Donate 10 XLM", exact: true });
    await expect(submit).toBeInViewport();
    const bounds = await dialog.boundingBox();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(width);
    if (width === 320) expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeCloseTo(900, 0);
    await page.screenshot({ path: testInfo.outputPath(`contribution-${width}.png`) });
    await submit.click();
    await expect(dialog.getByText(/10 XLM donated successfully/)).toBeVisible();
    await dialog.getByRole("button", { name: "Close", exact: true }).last().click();
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });
}

test("mobile sheet respects reduced motion and keyboard dismissal in dark mode", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await page.addInitScript(() => {
    localStorage.setItem("onboarding_tour_dismissed", "1");
    sessionStorage.setItem(
      "stellar_wallet_public_key",
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    );
  });
  await page.goto("/en/causes/1");
  await expect(page.locator("html")).toHaveClass(/dark/);
  const trigger = page.getByRole("button", { name: /Fund This Cause/ }).first();
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((node) => getComputedStyle(node).animationName)).toBe("none");
  await expect(dialog.getByRole("button", { name: "Donate", exact: true })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("contribution-dark-320.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("previews a banner and cancels unsaved changes", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("onboarding_tour_dismissed", "1");
    sessionStorage.setItem(
      "stellar_wallet_public_key",
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    );
  });
  await page.goto("/en/profile");
  await page.getByRole("button", { name: "Customize profile" }).click();
  await page.getByLabel("Banner image", { exact: true }).setInputFiles({
    name: "banner.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  const preview = page.getByRole("img", { name: "Creator profile banner" });
  await expect(preview).toBeVisible();
  await expect(preview).toHaveJSProperty("naturalWidth", 1);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(preview).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Customize profile" })).toBeVisible();
  await expect(preview).not.toBeVisible();
});

test("renders the new Spanish roadmap and profile controls", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("onboarding_tour_dismissed", "1");
    sessionStorage.setItem(
      "stellar_wallet_public_key",
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    );
  });
  await page.goto("/es/profile");
  await page.getByRole("button", { name: "Personalizar perfil" }).click();
  await expect(page.getByLabel("Nombre para mostrar")).toBeVisible();
  await page.goto("/es/causes/1");
  await expect(page.getByRole("region", { name: "Hitos de recaudación" })).toBeVisible();
  await expect(page.getByText("Próximo hito")).toBeVisible();
});
