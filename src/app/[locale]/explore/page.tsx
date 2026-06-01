import { Metadata } from "next";
import { buildAlternates } from "@/lib/seo";
import ExploreClient from "./ExploreClient";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;

  return {
    title: "Explore Causes | ProofOfHeart",
    description: "Browse and explore all causes on ProofOfHeart by category, status and funding.",
    openGraph: {
      title: "Explore Causes | ProofOfHeart",
      description: "Browse and explore all causes on ProofOfHeart.",
      siteName: "ProofOfHeart",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Explore Causes | ProofOfHeart",
      description: "Browse and explore all causes on ProofOfHeart.",
    },
    alternates: buildAlternates("/explore", locale),
  } as Metadata;
}

export default function Page() {
  return <ExploreClient />;
}
