import { Metadata } from "next";
import { buildAlternates } from "@/lib/seo";
import NewCauseClient from "./NewCauseClient";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;

  return {
    title: "Create a Cause | ProofOfHeart",
    description: "Start a new fundraising cause on ProofOfHeart and get community validation.",
    openGraph: {
      title: "Create a Cause | ProofOfHeart",
      description: "Start a new fundraising cause on ProofOfHeart.",
      siteName: "ProofOfHeart",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Create a Cause | ProofOfHeart",
      description: "Start a new fundraising cause on ProofOfHeart.",
    },
    alternates: buildAlternates("/causes/new", locale),
  } as Metadata;
}

export default function Page() {
  return <NewCauseClient />;
}
