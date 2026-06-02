import { MetadataRoute } from "next";
import { getAllCampaigns } from "@/lib/contractClient";
import { absoluteUrl } from "@/lib/seo";
import { routing } from "@/i18n/routing";

// Static routes to include in the sitemap.
// All paths are relative — the sitemap builder prepends /${locale} for each locale.
// Do NOT include non-localized bare paths here; canonical URLs are locale-prefixed.
const STATIC_ROUTES = ["", "/causes", "/causes/new", "/about", "/dashboard"];

/** Caps dynamic URLs so sitemap generation stays bounded as campaign count grows. */
const MAX_CAMPAIGN_SITEMAP_URLS = 10_000;

async function getCampaignSitemapEntries(): Promise<
  Pick<MetadataRoute.Sitemap[number], "url" | "lastModified" | "changeFrequency" | "priority">[]
> {
  try {
    const campaigns = await getAllCampaigns();
    const capped = campaigns.slice(0, MAX_CAMPAIGN_SITEMAP_URLS);

    return capped.flatMap((campaign) =>
      routing.locales.map((locale) => ({
        url: absoluteUrl(`/${locale}/causes/${campaign.id}`),
        lastModified: new Date(campaign.created_at * 1000),
        changeFrequency: "hourly" as const,
        priority: 0.9,
      })),
    );
  } catch {
    return [];
  }
}

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const campaignEntries = await getCampaignSitemapEntries();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.flatMap((route) =>
    routing.locales.map((locale) => ({
      url: absoluteUrl(`/${locale}${route}`),
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: route === "" ? 1 : 0.8,
    })),
  );

  return [...staticEntries, ...campaignEntries];
}
