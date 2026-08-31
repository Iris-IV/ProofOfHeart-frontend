/**
 * Hosts that campaign cover media may be served from.
 *
 * Cover URLs are creator-supplied (`cover_image_url`), so any server-side
 * fetch of them — currently the Open Graph renderer — must be restricted to
 * this allow-list to prevent SSRF. The same list drives `images.remotePatterns`
 * in `next.config.ts` so the two can never drift apart.
 *
 * Covers are uploaded directly to IPFS/Arweave and only those hosts (plus the
 * legacy Imgur and demo Unsplash sources) are reachable from the app.
 *
 * Note: relative or same-origin cover URLs never pass this guard, so a cover
 * must be an absolute https URL on one of these hosts or it will not be
 * embedded in the generated Open Graph card.
 */
export const ALLOWED_CAMPAIGN_IMAGE_HOSTS: readonly string[] = [
  // IPFS gateways (for decentralized campaign images)
  "ipfs.io",
  "cloudflare-ipfs.com",
  "ipfs.dweb.link",
  // Arweave (for permanent campaign storage)
  "arweave.net",
  // GitHub user content (for creator avatars, limited to raw.githubusercontent.com)
  "raw.githubusercontent.com",
  // Imgur (legacy support, consider migrating to IPFS)
  "i.imgur.com",
  // Unsplash (for placeholder/demo images only)
  "images.unsplash.com",
];

/** True when `url` is https and its host is on the campaign media allow-list. */
export function isAllowedCampaignImageUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.protocol === "https:" && ALLOWED_CAMPAIGN_IMAGE_HOSTS.includes(parsed.hostname);
}
