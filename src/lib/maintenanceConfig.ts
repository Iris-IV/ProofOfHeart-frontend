// Shared maintenance-mode constants used by both the edge middleware and the
// client-side bypass component. Kept in a dedicated module (rather than
// exported from middleware.ts) so client components don't pull in
// next-intl/next/server middleware code via the import graph.

export const MAINTENANCE_COOKIE = "maintenance_bypass";
export const BYPASS_COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours, in seconds
