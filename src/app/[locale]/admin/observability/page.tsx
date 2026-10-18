"use client";

import dynamic from "next/dynamic";

const ObservabilityDashboard = dynamic(() => import("@/components/admin/ObservabilityDashboard"), {
  ssr: false,
});

export default function AdminObservabilityPage() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <ObservabilityDashboard />
    </div>
  );
}
