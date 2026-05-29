import { routing } from "@/i18n/routing";

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
