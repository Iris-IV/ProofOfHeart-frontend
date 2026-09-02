import { getTranslations } from "next-intl/server";
import { buildAlternates } from "/lib/seo";
import CausesClient from "./CausesClient";

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

export default async function CausesPage() {
  const t = await getTranslations("Causes");
  const emptyState = (
    <div>
      <h2>{t("noCausesTitle")}</h2>
      <p>{t("noCausesMessage")}</p>
    </div>
  );
  return <CausesClient emptyState={emptyState} />;
}