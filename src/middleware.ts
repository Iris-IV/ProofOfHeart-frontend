import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const MAINTENANCE_COOKIE = "maintenance_bypass";
const BYPASS_COOKIE_MAX_AGE = 60 * 60 * 24; // 24 h

function isMaintenanceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true";
}

function getAllowlist(): string[] {
  const raw = process.env.NEXT_PUBLIC_MAINTENANCE_ALLOWLIST ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isBypassed(req: NextRequest): boolean {
  const allowlist = getAllowlist();
  if (allowlist.length === 0) return false;
  const cookie = req.cookies.get(MAINTENANCE_COOKIE)?.value ?? "";
  return allowlist.includes(cookie.toLowerCase());
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow: the maintenance page itself, API routes, static assets
  const isExempt =
    pathname === "/maintenance" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(ico|svg|png|jpg|jpeg|webp|woff2?)$/);

  if (isMaintenanceEnabled() && !isExempt && !isBypassed(req)) {
    const url = req.nextUrl.clone();
    url.pathname = "/maintenance";
    return NextResponse.redirect(url);
  }

  const response = intlMiddleware(req);

  // #621 — Enforce HSTS on every response (including intl redirects) so that
  // browsers always upgrade HTTP to HTTPS and preload the domain.
  // next.config.ts sets the same header for route-level responses; middleware
  // covers maintenance redirects and locale redirects that bypass that layer.
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  return response;
}

export { MAINTENANCE_COOKIE, BYPASS_COOKIE_MAX_AGE };

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
