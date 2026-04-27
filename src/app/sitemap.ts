import { MetadataRoute } from "next";

const BASE_URL = "https://proofofheart.org";
const LOCALES = ["en", "es"];

// Static routes to include in the sitemap
const STATIC_ROUTES = ["", "/causes", "/causes/new", "/explore", "/about", "/dashboard"];

async function getCampaignIds(): Promise<number[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/campaigns`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((c: { id: number }) => c.id);
  } catch {
    // If the API is unreachable during build, return empty array
    return [];
  }
}

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const campaignIds = await getCampaignIds();

  // Build static routes for all locales
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.flatMap((route) =>
    LOCALES.map((locale) => ({
      url: `${BASE_URL}/${locale}${route}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: route === "" ? 1 : 0.8,
    })),
  );

  // Build dynamic campaign routes for all locales
  const campaignEntries: MetadataRoute.Sitemap = campaignIds.flatMap((id) =>
    LOCALES.map((locale) => ({
      url: `${BASE_URL}/${locale}/causes/${id}`,
      lastModified: new Date(),
      changeFrequency: "hourly" as const,
      priority: 0.9,
    })),
  );

  return [...staticEntries, ...campaignEntries];
}
