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

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
