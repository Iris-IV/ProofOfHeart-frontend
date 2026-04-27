import { buildAlternates } from "@/lib/seo";
import CausesClient from "./CausesClient";

// #151 — ISR: allow the edge cache to serve a stale snapshot of the /causes
// listing for up to 30 seconds before revalidating in the background. This
// improves TTFB and SEO without sacrificing data freshness for active users.
export const revalidate = 30;

export function generateMetadata() {
  return {
    alternates: buildAlternates("/causes"),
  };
}

export default CausesClient;
