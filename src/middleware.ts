import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { buildCspHeader, CSP_NONCE_HEADER, generateCspNonce } from "./lib/csp";

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

  // #569 — Generate a per-request CSP nonce so inline scripts (the theme
  // blocking script in <head>) can be allow-listed without `'unsafe-inline'`.
  const nonce = generateCspNonce();
  const isDev = process.env.NODE_ENV !== "production";
  // Dev adapts the policy for the Report-Only context: `eval` is allowed (the
  // Turbopack dev runtime evaluates RSC code with it), `frame-ancestors` is
  // dropped (ignored in Report-Only; WebKit logs a console error about it),
  // and `report-to` is added (WebKit warns that a Report-Only policy without
  // it has no effect). This keeps the local console — and the e2e
  // console-error assertions — noise-free while genuine violations still
  // surface.
  const cspHeader = buildCspHeader(nonce, { development: isDev });

  // Propagate the nonce to the layout via a request header so it can attach the
  // same value to the <script nonce="…"> attribute.
  req.headers.set(CSP_NONCE_HEADER, nonce);

  // #569 — Next.js only applies the nonce to its own framework-injected inline
  // scripts (the self.__next_f flight-payload bootstrap) when it can see the
  // Content-Security-Policy header on the *incoming request* headers. Mirror
  // the header on the request (pattern from the Next.js CSP docs) so hydration
  // scripts carry a matching nonce; the response header below is what the
  // browser enforces. Set on the request in both environments so the nonce
  // plumbing is exercised locally too.
  req.headers.set("Content-Security-Policy", cspHeader);

  const response = intlMiddleware(req);

  // #569 — Apply strict CSP with the nonce. Next.js merges headers from
  // middleware with those from next.config.ts; setting it here overrides the
  // static value.
  //
  // Production enforces the policy. Development ships the same policy as
  // Content-Security-Policy-Report-Only (plus `'unsafe-eval'`, which the
  // Turbopack dev runtime needs), so the header is only enforced where it is
  // safe — but Report-Only still surfaces genuine policy violations in the
  // local console, so a break like the nonce-propagation issue above shows up
  // in dev instead of only after deploy.
  if (isDev) {
    response.headers.set("Content-Security-Policy-Report-Only", cspHeader);
    // WebKit only treats Report-Only policies that name a reporting group as
    // effective. No collector exists locally, but declaring the endpoint (the
    // group referenced by the `report-to` directive above) silences the
    // "policy will have no effect" console error.
    response.headers.set("Reporting-Endpoints", 'csp-endpoint="/api/csp-report"');
  } else {
    response.headers.set("Content-Security-Policy", cspHeader);
  }

  // #621 — Enforce HSTS on every response (including intl redirects) so that
  // browsers always upgrade HTTP to HTTPS and preload the domain.
  // next.config.ts sets the same header for route-level responses; middleware
  // covers maintenance redirects and locale redirects that bypass that layer.
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  return response;
}

export { MAINTENANCE_COOKIE, BYPASS_COOKIE_MAX_AGE };

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
