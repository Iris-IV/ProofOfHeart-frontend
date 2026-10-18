import { NextRequest, NextResponse } from "next/server";
import { getReportRepository } from "@/lib/reportRepository";
import { z } from "zod";

const PatchReportBodySchema = z.object({
  status: z.literal("reviewed"),
});

// PATCH /api/reports/[reportId]  — mark a report as reviewed (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await params;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PatchReportBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ message: "status must be 'reviewed'" }, { status: 400 });
  }

  const updated = await getReportRepository().markReviewed(reportId);
  if (!updated) {
    return NextResponse.json({ message: "Report not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
