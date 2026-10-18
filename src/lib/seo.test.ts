import { getStellarResourceHints, STELLAR_PRECONNECT_ORIGINS } from "@/lib/seo";

describe("Stellar Endpoints Resource Hints (#1585)", () => {
  it("generates preconnect and dns-prefetch links for Stellar RPC and IPFS gateways", () => {
    const hints = getStellarResourceHints();

    expect(hints.length).toBe(STELLAR_PRECONNECT_ORIGINS.length * 2);

    const preconnects = hints.filter((h) => h.rel === "preconnect");
    const dnsPrefetches = hints.filter((h) => h.rel === "dns-prefetch");

    expect(preconnects.length).toBe(STELLAR_PRECONNECT_ORIGINS.length);
    expect(dnsPrefetches.length).toBe(STELLAR_PRECONNECT_ORIGINS.length);

    expect(preconnects.map((h) => h.href)).toContain("https://horizon-testnet.stellar.org");
    expect(preconnects.map((h) => h.href)).toContain("https://ipfs.io");
  });
});
