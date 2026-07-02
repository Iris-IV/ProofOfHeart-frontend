import { test, expect } from "./fixtures";

test("debug mock mode on client", async ({ page }) => {
  const logs: string[] = [];
  const failed: string[] = [];
  page.on("console", (msg) => logs.push(`${msg.type()}: ${msg.text()}`));
  page.on("requestfailed", (req) => failed.push(`${req.url()} - ${req.failure()?.errorText}`));
  page.on("response", (res) => {
    if (res.status() === 404) failed.push(`404 ${res.url()}`);
  });

  await page.goto("/en/causes/1");
  await page.waitForTimeout(3000);
  console.log("FAILED REQUESTS:", failed.join("\n"));
  console.log("BROWSER LOGS:", logs.filter((l) => l.includes("getCampaign")).join("\n") || "(no getCampaign logs)");
});
