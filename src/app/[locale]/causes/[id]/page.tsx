import { buildAlternates } from "@/lib/seo";
import CauseDetailClient from "./CauseDetailClient";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return {
    alternates: buildAlternates(`/causes/${id}`),
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <CauseDetailClient id={id} />;
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <CauseDetailClient id={id} />;
}