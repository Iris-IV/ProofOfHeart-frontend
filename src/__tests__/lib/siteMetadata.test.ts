import { siteMetadata, getCanonicalUrl } from "@/lib/siteMetadata";

describe("site metadata canonical URLs", () => {
  it("declares canonical url in siteMetadata alternates", () => {
    expect(siteMetadata.alternates).toHaveProperty("canonical", "https://proofofheart.xyz/en");
    expect(siteMetadata.alternates?.languages).toHaveProperty("en", "https://proofofheart.xyz/en");
    expect(siteMetadata.alternates?.languages).toHaveProperty("es", "https://proofofheart.xyz/es");
    expect(siteMetadata.alternates?.languages).toHaveProperty(
      "x-default",
      "https://proofofheart.xyz/en",
    );
  });

  it("generates correct canonical URLs via getCanonicalUrl", () => {
    expect(getCanonicalUrl("/causes/123", "en")).toBe("https://proofofheart.xyz/en/causes/123");
    expect(getCanonicalUrl("explore", "es")).toBe("https://proofofheart.xyz/es/explore");
    expect(getCanonicalUrl("/", "en")).toBe("https://proofofheart.xyz/en");
  });
});
