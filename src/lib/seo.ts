import { routing } from "@/i18n/routing";
import type { Campaign } from "@/types";
import { stroopsToXlm } from "@/lib/stellarAmount";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://proofofheart.xyz").replace(/\/+$/, "");

export function absoluteUrl(path: string): string {
  if (!path) return SITE_URL;
  if (/^https?:\/\//i.test(path)) return path;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalizedPath}`;
}

export function buildAlternates(path: string, locale: string = routing.defaultLocale) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const normalizedLocale = routing.locales.includes(locale) ? locale : routing.defaultLocale;

  const languages: Record<string, string> = {};
  for (const supportedLocale of routing.locales) {
    languages[supportedLocale] = `${SITE_URL}/${supportedLocale}${normalizedPath}`;
  }

  languages["x-default"] = `${SITE_URL}/${routing.defaultLocale}${normalizedPath}`;

  return {
    canonical: `${SITE_URL}/${normalizedLocale}${normalizedPath}`,
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
): Record<string, unknown> {
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
      ...(campaign.deadline
        ? [
            {
              "@type": "PropertyValue",
              name: strings.deadlineLabel,
              value: new Date(campaign.deadline * 1000).toISOString(),
            },
          ]
        : []),
    ],
  };

  if (campaign.cover_image_url) {
    const safeCoverImage = absoluteUrl(campaign.cover_image_url);
    if (/^https?:\/\//i.test(safeCoverImage)) {
      schema.image = safeCoverImage;
    }
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
 * Resource hint domain origins for Stellar Horizon RPC and IPFS gateways.
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

export function getStellarResourceHints(): ResourceHintLink[] {
  return STELLAR_PRECONNECT_ORIGINS.flatMap((origin) => [
    { rel: "preconnect", href: origin, crossOrigin: "anonymous" },
    { rel: "dns-prefetch", href: origin },
  ]);
}
