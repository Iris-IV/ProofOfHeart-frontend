import HomeClient from "./HomeClient";
import { buildAlternates } from "@/lib/seo";

export function generateMetadata() {
  const title = "ProofOfHeart | Decentralized Community Launchpad";
  const description = "Validating causes and managing on-chain contributions with full transparency and community trust.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: buildAlternates(""),
  };
}

export default HomeClient;
