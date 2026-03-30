import CauseDetailClient from './CauseDetailClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;

  return <CauseDetailClient id={id} />;
}
