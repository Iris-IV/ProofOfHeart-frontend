export default function robots() {
  const isProduction = process.env.NODE_ENV === "production";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://proofofheart.xyz";

  if (!isProduction) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
      sitemap: `${siteUrl}/sitemap.xml`,
    };
  }

  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
