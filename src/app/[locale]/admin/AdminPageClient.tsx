"use client";

import dynamic from "next/dynamic";
import { AdminSkeleton } from "@/components/Skeleton";

const AdminClient = dynamic(() => import("./AdminClient"), {
  ssr: false,
  loading: () => <AdminSkeleton />,
});

export default function AdminPageClient() {
  return <AdminClient />;
}
