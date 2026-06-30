jest.mock("@/lib/contractClient", () => ({
  getAllCampaigns: jest.fn(),
}));

jest.mock("@/i18n/routing", () => ({
  routing: { locales: ["en", "es"], defaultLocale: "en" },
}));

jest.mock("@/lib/seo", () => ({
  absoluteUrl: (path: string) => `https://example.test${path.startsWith("/") ? path : `/${path}`}`,
}));

import sitemap from "@/app/sitemap";
import { getAllCampaigns } from "@/lib/contractClient";

const mockedGetAllCampaigns = getAllCampaigns as jest.MockedFunction<typeof getAllCampaigns>;

describe("sitemap", () => {
  beforeEach(() => {
    mockedGetAllCampaigns.mockReset();
  });

  it("includes cause detail URLs for each locale", async () => {
    mockedGetAllCampaigns.mockResolvedValue([
      {
        id: 42,
        created_at: 1_700_000_000,
      } as Awaited<ReturnType<typeof getAllCampaigns>>[number],
    ]);

    const entries = await sitemap();

    expect(entries).toContainEqual(
      expect.objectContaining({
        url: "https://example.test/en/causes/42",
        changeFrequency: "hourly",
        priority: 0.9,
      }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        url: "https://example.test/es/causes/42",
        changeFrequency: "hourly",
        priority: 0.9,
      }),
    );
  });

  it("returns static routes when campaign fetch fails", async () => {
    mockedGetAllCampaigns.mockRejectedValue(new Error("rpc down"));

    const entries = await sitemap();

    expect(entries.some((e) => e.url === "https://example.test/en/causes")).toBe(true);
    expect(entries.filter((e) => /\/causes\/\d+$/.test(e.url))).toHaveLength(0);
  });
});
