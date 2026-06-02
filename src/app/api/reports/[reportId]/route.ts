import { NextRequest, NextResponse } from "next/server";
import { reportStore } from "@/lib/reportStore";

// PATCH /api/reports/[reportId]  — mark a report as reviewed (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await params;

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  if (body.status !== "reviewed") {
    return NextResponse.json({ message: "status must be 'reviewed'" }, { status: 400 });
  }

  const idx = reportStore.findIndex((r) => r.id === reportId);
  if (idx === -1) {
    return NextResponse.json({ message: "Report not found" }, { status: 404 });
  }

  reportStore[idx] = { ...reportStore[idx], status: "reviewed" };
  return NextResponse.json(reportStore[idx]);
}
