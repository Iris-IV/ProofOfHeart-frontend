import { routing } from "@/i18n/routing";
import type { Campaign } from "@/types";
import { stroopsToXlm } from "@/lib/stellarAmount";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://proofofheart.xyz";

export function absoluteUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildAlternates(path: string, locale: string = routing.defaultLocale) {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = `${SITE_URL}/${locale}${path}`;
  }
  languages["x-default"] = `${SITE_URL}/${routing.defaultLocale}${path}`;
  return {
    canonical: `${SITE_URL}/${locale}${path}`,
    languages,
  };
}

interface CauseJsonLdStrings {
  donateActionName: string;
  fundingGoalLabel: string;
  amountRaisedLabel: string;
  deadlineLabel: string;
}

export function buildCauseJsonLd(
  campaign: Campaign,
  locale: string,
  strings: CauseJsonLdStrings,
): object {
  const url = absoluteUrl(`/${locale}/causes/${campaign.id}`);
  const isAcceptingDonations = campaign.status === "active" || campaign.status === "verified";

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Project",
    name: campaign.title,
    description: campaign.description,
    url,
    inLanguage: locale,
    dateCreated: new Date(campaign.created_at * 1000).toISOString(),
    provider: {
      "@type": "Organization",
      name: "ProofOfHeart",
      url: absoluteUrl("/"),
    },
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: strings.fundingGoalLabel,
        value: stroopsToXlm(campaign.funding_goal),
        unitText: "XLM",
      },
      {
        "@type": "PropertyValue",
        name: strings.amountRaisedLabel,
        value: stroopsToXlm(campaign.amount_raised),
        unitText: "XLM",
      },
      {
        "@type": "PropertyValue",
        name: strings.deadlineLabel,
        value: new Date(campaign.deadline * 1000).toISOString(),
      },
    ],
  };

  if (campaign.cover_image_url) {
    schema.image = absoluteUrl(campaign.cover_image_url);
  }

  if (isAcceptingDonations) {
    schema.potentialAction = {
      "@type": "DonateAction",
      name: strings.donateActionName,
      target: {
        "@type": "EntryPoint",
        urlTemplate: url,
      },
    };
  }

  return schema;
}

/**
 * Resource hint domain origins for Stellar Horizon RPC and IPFS gateways (#1585).
 */
export const STELLAR_PRECONNECT_ORIGINS = [
  "https://horizon-testnet.stellar.org",
  "https://soroban-testnet.stellar.org",
  "https://horizon.stellar.org",
  "https://ipfs.io",
] as const;

export interface ResourceHintLink {
  rel: "preconnect" | "dns-prefetch";
  href: string;
  crossOrigin?: string;
}

/**
 * Generates preconnect and dns-prefetch resource hints for Stellar RPC and IPFS origins.
 */
export function getStellarResourceHints(): ResourceHintLink[] {
  const hints: ResourceHintLink[] = [];

  for (const origin of STELLAR_PRECONNECT_ORIGINS) {
    hints.push({ rel: "preconnect", href: origin, crossOrigin: "anonymous" });
    hints.push({ rel: "dns-prefetch", href: origin });
  }

  return hints;
}
