import { NextRequest, NextResponse } from "next/server";
import { getReportRepository } from "@/lib/reportRepository";
import { CampaignReport } from "@/lib/campaignReports";
import { createRateLimiter, rateLimitKeyFromRequest } from "@/lib/rateLimit";
import { CreateReportBodySchema } from "@/lib/schemas";

const reportRateLimiter = createRateLimiter("campaign_reports", 60_000, 3);

// GET /api/reports  — admin moderation queue
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const status = statusParam === "pending" || statusParam === "reviewed" ? statusParam : undefined;

  const results = await getReportRepository().list(status);
  return NextResponse.json(results);
}

// POST /api/reports — submit a new abuse report
export async function POST(req: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateReportBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { message: firstIssue?.message ?? "Invalid request body" },
      { status: 400 },
    );
  }

  const { campaignId, campaignTitle, reason, notes, reporterAddress } = parsed.data;
  const repository = getReportRepository();

  // Rate limit: keyed by reporter address or IP
  const rateLimitKey = rateLimitKeyFromRequest(req, reporterAddress);
  if (!(await reportRateLimiter.check(rateLimitKey))) {
    return NextResponse.json(
      { message: "Too many reports. Please wait before reporting again." },
      { status: 429 },
    );
  }

  // Spam protection: prevent duplicate reports from the same address for the same campaign
  if (reporterAddress && (await repository.hasReporter(campaignId, reporterAddress))) {
    return NextResponse.json(
      { message: "You have already reported this campaign." },
      { status: 409 },
    );
  }

  const existing = await repository.list();
  const reportCounter = existing.length + 1;
  const report: CampaignReport = {
    id: `report-${campaignId}-${reportCounter}`,
    campaignId,
    campaignTitle,
    reason,
    notes,
    reporterAddress: reporterAddress ?? null,
    timestamp: 1700000000000 + reportCounter * 1000,
    status: "pending",
  };

  await repository.add(report);
  return NextResponse.json(report, { status: 201 });
}
