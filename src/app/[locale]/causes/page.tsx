import { getTranslations } from "next-intl/server";
import CausesClient from "./CausesClient";
import { buildAlternates } from "@/lib/seo";

// #151 — ISR: allow the edge cache to serve a stale snapshot of the /causes
// listing for up to 30 seconds before revalidating in the background. This
// improves TTFB and SEO without sacrificing data freshness for active users.
export const revalidate = 30;

export async function generateMetadata() {
  const t = await getTranslations("Causes");
  const title = `${t("pageTitle")} | ProofOfHeart`;
  const description = t("pageSubtitle");

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: buildAlternates("/causes"),
  };
}

export default CausesClient;
