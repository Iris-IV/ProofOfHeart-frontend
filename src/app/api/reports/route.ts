import { NextRequest, NextResponse } from "next/server";
import { reportStore } from "@/lib/reportStore";
import { CampaignReport, ReportReason, REPORT_REASON_LABELS } from "@/lib/campaignReports";

const VALID_REASONS = Object.keys(REPORT_REASON_LABELS) as ReportReason[];
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 3;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

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
  let body: {
    campaignId?: number;
    campaignTitle?: string;
    reason?: string;
    notes?: string;
    reporterAddress?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { campaignId, campaignTitle, reason, notes = "", reporterAddress = null } = body;

  if (!campaignId || typeof campaignId !== "number") {
    return NextResponse.json({ message: "campaignId is required" }, { status: 400 });
  }
  if (!campaignTitle || typeof campaignTitle !== "string") {
    return NextResponse.json({ message: "campaignTitle is required" }, { status: 400 });
  }
  if (!reason || !VALID_REASONS.includes(reason as ReportReason)) {
    return NextResponse.json(
      { message: `reason must be one of: ${VALID_REASONS.join(", ")}` },
      { status: 400 },
    );
  }

  // Rate limit: keyed by reporter address or IP
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "anon";
  const rateLimitKey = reporterAddress ?? ip;
  if (!checkRateLimit(rateLimitKey)) {
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

  const report: CampaignReport = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    campaignId,
    campaignTitle,
    reason: reason as ReportReason,
    notes: typeof notes === "string" ? notes.slice(0, 1000) : "",
    reporterAddress: reporterAddress ?? null,
    timestamp: Date.now(),
    status: "pending",
  };

  reportStore.push(report);
  return NextResponse.json(report, { status: 201 });
}
