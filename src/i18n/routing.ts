import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";
import { LOCALE_COOKIE_MAX_AGE } from "@/lib/preferences";

/**
 * Locale routing for next-intl. Consumed by the middleware, the `[locale]` layout,
 * the sitemap and the navigation wrappers exported below.
 *
 * Adding a locale touches more than this list. See `docs/I18N.md`, "Adding a new language".
 */
export const routing = defineRouting({
  /** Supported locales. Each needs a matching `messages/<locale>.json` catalog. */
  locales: ["en", "es"],

  /** Used when no locale matches the request. */
  defaultLocale: "en",

  /** Persists the explicit locale choice across browser sessions (#429). */
  localeCookie: {
    maxAge: LOCALE_COOKIE_MAX_AGE,
  },
});

// Critical routes eligible for prefetching on user hover to improve Web Vitals and transition speed
export const CRITICAL_PREFETCH_ROUTES = ["/causes", "/explore"] as const;

export function shouldPrefetchOnHover(href: string): boolean {
  if (!href || typeof href !== "string") return false;
  return (
    href.startsWith("/causes/") ||
    href.startsWith("/explore") ||
    CRITICAL_PREFETCH_ROUTES.some((route) => href === route || href.startsWith(`${route}/`))
  );
}

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
