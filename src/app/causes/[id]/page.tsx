import CauseDetailClient from './CauseDetailClient';

interface PageProps {
  params: { id: string };
}

export default function Page({ params }: PageProps) {
  return <CauseDetailClient id={params.id} />;
}
