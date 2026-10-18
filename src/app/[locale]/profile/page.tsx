import { Metadata } from "next";
import { buildAlternates } from "@/lib/seo";
import ProfileClient from "./ProfileClient";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "My Profile | ProofOfHeart",
    description: "View your impact, contributions, and saved campaigns on ProofOfHeart.",
    robots: { index: false },
    alternates: buildAlternates("/profile", locale),
  };
}

export default function Page() {
  return <ProfileClient />;
}
