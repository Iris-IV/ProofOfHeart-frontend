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

  return intlMiddleware(req);
}

export { MAINTENANCE_COOKIE, BYPASS_COOKIE_MAX_AGE };

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
