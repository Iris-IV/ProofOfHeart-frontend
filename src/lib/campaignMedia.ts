/**
 * Hosts that campaign cover media may be served from.
 *
 * Cover URLs are creator-supplied (`cover_image_url`), so any server-side
 * fetch of them — currently the Open Graph renderer — must be restricted to
 * this allow-list to prevent SSRF. The same list drives `images.remotePatterns`
 * in `next.config.ts` so the two can never drift apart.
 */
export const ALLOWED_CAMPAIGN_IMAGE_HOSTS = Object.freeze([
  "ipfs.io",
  "cloudflare-ipfs.com",
  "ipfs.dweb.link",
  "arweave.net",
  "raw.githubusercontent.com",
  "i.imgur.com",
  "images.unsplash.com",
] as const);

export function normalizeCampaignImageUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;

    const hostname = parsed.hostname.toLowerCase();
    if (!ALLOWED_CAMPAIGN_IMAGE_HOSTS.includes(hostname as (typeof ALLOWED_CAMPAIGN_IMAGE_HOSTS)[number])) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export function isAllowedCampaignImageUrl(url: string): boolean {
  return normalizeCampaignImageUrl(url) !== null;
}
