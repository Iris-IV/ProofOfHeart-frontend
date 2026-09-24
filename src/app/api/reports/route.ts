import { NextRequest, NextResponse } from "next/server";
import { reportStore } from "@/lib/reportStore";
import { CampaignReport } from "@/lib/campaignReports";
import { createRateLimiter, rateLimitKeyFromRequest } from "@/lib/rateLimit";
import { CreateReportBodySchema } from "@/lib/schemas";

const reportRateLimiter = createRateLimiter(60_000, 3);

// GET /api/reports  — admin moderation queue
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "all";

  const results =
    status === "pending"
      ? reportStore.filter((r) => r.status === "pending")
      : status === "reviewed"
        ? reportStore.filter((r) => r.status === "reviewed")
        : [...reportStore];

  results.sort((a, b) => b.timestamp - a.timestamp);
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

  // Rate limit: keyed by reporter address or IP
  const rateLimitKey = rateLimitKeyFromRequest(req, reporterAddress);
  if (!reportRateLimiter.check(rateLimitKey)) {
    return NextResponse.json(
      { message: "Too many reports. Please wait before reporting again." },
      { status: 429 },
    );
  }

  // Spam protection: prevent duplicate reports from the same address for the same campaign
  if (reporterAddress) {
    const alreadyReported = reportStore.some(
      (r) => r.campaignId === campaignId && r.reporterAddress === reporterAddress,
    );
    if (alreadyReported) {
      return NextResponse.json(
        { message: "You have already reported this campaign." },
        { status: 409 },
      );
    }
  }

  const reportCounter = reportStore.length + 1;
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

  reportStore.push(report);
  return NextResponse.json(report, { status: 201 });
}
