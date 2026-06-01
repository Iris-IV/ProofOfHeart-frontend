import { Metadata } from "next";
import dynamic from "next/dynamic";
import { buildAlternates } from "@/lib/seo";
import { AdminSkeleton } from "@/components/Skeleton";

const AdminClient = dynamic(() => import("./AdminClient"), {
  ssr: false,
  loading: () => <AdminSkeleton />,
});

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;

  return {
    title: "Admin Dashboard | ProofOfHeart",
    description: "Admin control panel for ProofOfHeart platform management.",
    openGraph: {
      title: "Admin Dashboard | ProofOfHeart",
      description: "Admin control panel for ProofOfHeart.",
      siteName: "ProofOfHeart",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Admin Dashboard | ProofOfHeart",
      description: "Admin control panel for ProofOfHeart.",
    },
    alternates: buildAlternates("/admin", locale),
  } as Metadata;
}

export default function Page() {
  return <AdminClient />;
}
