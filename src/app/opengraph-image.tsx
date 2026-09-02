import { ImageResponse } from "next/og";
import { BrandOgCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/ogCard";

/**
 * #642 — Site-wide default Open Graph image.
 *
 * Metadata file conventions cascade, so every route that does not ship its own
 * `opengraph-image` inherits this one. Emitting it as a file convention (instead of
 * a hard-coded `openGraph.images` entry) is what makes Next write `og:image:type`,
 * `og:image:width` and `og:image:height` that provably match the delivered bytes —
 * the mismatch Apple's scraper rejects.
 */
export const alt = "ProofOfHeart — a decentralized launchpad for community-validated causes";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpengraphImage() {
  return new ImageResponse(
    <BrandOgCard
      title="ProofOfHeart"
      subtitle="Community-validated causes, contributions accounted for on-chain."
    />,
    { ...size },
  );
}
