import { Metadata } from "next";
import { buildAlternates } from "@/lib/seo";
import DashboardClient from "./DashboardClient";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;

  return {
    title: "My Dashboard | ProofOfHeart",
    description: "View your contributions, campaigns and wallet activity on ProofOfHeart.",
    openGraph: {
      title: "My Dashboard | ProofOfHeart",
      description: "View your contributions and campaigns on ProofOfHeart.",
      siteName: "ProofOfHeart",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "My Dashboard | ProofOfHeart",
      description: "View your contributions and campaigns on ProofOfHeart.",
    },
    alternates: buildAlternates("/dashboard", locale),
  } as Metadata;
}

export default function Page() {
  return <DashboardClient />;
}
