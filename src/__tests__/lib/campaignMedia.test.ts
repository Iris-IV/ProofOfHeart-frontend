import { ALLOWED_CAMPAIGN_IMAGE_HOSTS, isAllowedCampaignImageUrl } from "@/lib/campaignMedia";

describe("isAllowedCampaignImageUrl", () => {
  it("accepts https URLs on allow-listed campaign media hosts", () => {
    expect(isAllowedCampaignImageUrl("https://ipfs.io/ipfs/QmCoverHash")).toBe(true);
    expect(isAllowedCampaignImageUrl("https://cloudflare-ipfs.com/ipfs/QmCoverHash")).toBe(true);
    expect(isAllowedCampaignImageUrl("https://ipfs.dweb.link/ipfs/QmCoverHash")).toBe(true);
    expect(isAllowedCampaignImageUrl("https://arweave.net/abc123")).toBe(true);
    expect(isAllowedCampaignImageUrl("https://raw.githubusercontent.com/user/repo/cover.png")).toBe(
      true,
    );
    expect(isAllowedCampaignImageUrl("https://i.imgur.com/abc.png")).toBe(true);
    expect(isAllowedCampaignImageUrl("https://images.unsplash.com/photo-1")).toBe(true);
  });

  it("rejects http, foreign hosts, suffix lookalikes, and malformed URLs", () => {
    // SSRF guard: anything off the allow-list is refused before a server fetch.
    expect(isAllowedCampaignImageUrl("http://ipfs.io/ipfs/x")).toBe(false);
    expect(isAllowedCampaignImageUrl("https://evil.example/ipfs/x")).toBe(false);
    expect(isAllowedCampaignImageUrl("https://ipfs.io.evil.example/x")).toBe(false);
    expect(isAllowedCampaignImageUrl("https://evil-ipfs.io/x")).toBe(false);
    expect(isAllowedCampaignImageUrl("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isAllowedCampaignImageUrl("https://localhost:8080/x")).toBe(false);
    expect(isAllowedCampaignImageUrl("not a url")).toBe(false);
    expect(isAllowedCampaignImageUrl("")).toBe(false);
  });

  it("keeps the allow-list a single, deduplicated source of truth", () => {
    expect(ALLOWED_CAMPAIGN_IMAGE_HOSTS.length).toBeGreaterThan(0);
    expect(new Set(ALLOWED_CAMPAIGN_IMAGE_HOSTS).size).toBe(ALLOWED_CAMPAIGN_IMAGE_HOSTS.length);
  });
});
