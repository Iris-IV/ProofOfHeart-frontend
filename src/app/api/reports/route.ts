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

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parsePageSize(raw: string | null): number {
  const parsed = parseInt(raw ?? String(DEFAULT_PAGE_SIZE), 10);
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Number.isFinite(parsed) ? parsed : DEFAULT_PAGE_SIZE));
}

function parsePage(raw: string | null): number {
  const parsed = parseInt(raw ?? "1", 10);
  return Math.max(1, Number.isFinite(parsed) ? parsed : 1);
}

function pickFields<T>(item: T, fields: string[]): Partial<T> {
  const picked: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in item) {
      picked[field] = (item as Record<string, unknown>)[field];
    }
  }
  return picked as Partial<T>;
}

// GET /api/reports?page=1&pageSize=20&status=all&fields=id,campaignId,status
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "all";
  const page = parsePage(url.searchParams.get("page"));
  const pageSize = parsePageSize(url.searchParams.get("pageSize"));
  const fields = url.searchParams.get("fields");
  const requestedFields = fields ? fields.split(",").map((f) => f.trim()).filter(Boolean) : [];

  const filtered =
    status === "pending"
      ? reportStore.filter((r) => r.status === "pending")
      : status === "reviewed"
        ? reportStore.filter((r) => r.status === "reviewed")
        : [...reportStore];

  filtered.sort((a, b) => b.timestamp - a.timestamp);
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize).map((item) =>
    requestedFields.length > 0 ? pickFields(item, requestedFields) : item,
  );

  return NextResponse.json({ items, total, page, pageSize, hasMore: page * pageSize < total });
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

  const reportCounter = reportStore.length + 1;
  const report: CampaignReport = {
    id: `report-${campaignId}-${reportCounter}`,
    campaignId,
    campaignTitle,
    reason: reason as ReportReason,
    notes: typeof notes === "string" ? notes.slice(0, 1000) : "",
    reporterAddress: reporterAddress ?? null,
    timestamp: 1700000000000 + reportCounter * 1000,
    status: "pending",
  };

  reportStore.push(report);
  return NextResponse.json(report, { status: 201 });
}
