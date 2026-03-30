"use client";

import { useParams } from 'next/navigation';
import CauseDetailClient from './CauseDetailClient';


export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <CauseDetailClient id={id} />;
}
