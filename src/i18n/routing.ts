import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";
import { LOCALE_COOKIE_MAX_AGE } from "@/lib/preferences";

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ["en", "es"],

  // Used when no locale matches
  defaultLocale: "en",

  // Persist explicit locale choice across browser sessions (#429)
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
    CRITICAL_PREFETCH_ROUTES.some(route => href === route || href.startsWith(`${route}/`))
  );
}

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
