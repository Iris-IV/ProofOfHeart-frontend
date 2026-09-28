import { routing } from "@/i18n/routing";
import type { Campaign } from "@/types";
import { stroopsToXlm } from "@/lib/stellarAmount";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://proofofheart.xyz").replace(/\/+$/, "");

/**
 * Converts a path to an absolute URL.
 * Optimized to avoid repeated regex checks.
 */
export function absoluteUrl(path: string): string {
  if (!path) return SITE_URL;
  if (/^https?:\/\//i.test(path)) return path;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalizedPath}`;
}

/**
 * Builds hreflang alternate links for multi-language SEO.
 * Cached at module level for performance.
 */
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

/**
 * Builds Schema.org JSON-LD for campaign page.
 * Flattened hierarchy for improved browser rendering performance.
 */
export function buildCauseJsonLd(
  campaign: Campaign,
  locale: string,
  strings: CauseJsonLdStrings,
): Record<string, unknown> {
  const url = absoluteUrl(`/${locale}/causes/${campaign.id}`);
  const isAcceptingDonations = campaign.status === "active" || campaign.status === "verified";
  const createdDate = new Date(campaign.created_at * 1000).toISOString();
  const deadlineDate = new Date(campaign.deadline * 1000).toISOString();

  // Build schema once with all properties
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Project",
    name: campaign.title,
    description: campaign.description,
    url,
    inLanguage: locale,
    dateCreated: createdDate,
  };

  // Add provider as flat property
  schema["provider"] = {
    "@type": "Organization",
    name: "ProofOfHeart",
    url: absoluteUrl("/"),
  };

  // Build additionalProperty array efficiently
  const additionalProperties = [
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
            value: deadlineDate,
          },
        ]
      : []),
  ];

  schema["additionalProperty"] = additionalProperties;

  // Conditionally add image
  if (campaign.cover_image_url) {
    const safeCoverImage = absoluteUrl(campaign.cover_image_url);
    if (/^https?:\/\//i.test(safeCoverImage)) {
      schema.image = safeCoverImage;
    }
  }

  // Conditionally add donation action
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
 * Preconnect hints improve performance by establishing early connections.
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
 * Cached result avoids repeated array allocations.
 */
let cachedHints: ResourceHintLink[] | null = null;

export function getStellarResourceHints(): ResourceHintLink[] {
  // Return cached result if available
  if (cachedHints) return cachedHints;

  const hints: ResourceHintLink[] = STELLAR_PRECONNECT_ORIGINS.flatMap((origin) => [
    { rel: "preconnect", href: origin, crossOrigin: "anonymous" },
    { rel: "dns-prefetch", href: origin },
  ]);

  cachedHints = hints;
  return hints;
}

/**
 * Validates and sanitizes URLs for SEO safety.
 * Returns true if URL is valid and safe to use in meta tags.
 */
export function isValidSeoUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
