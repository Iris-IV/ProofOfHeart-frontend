import { NextRequest, NextResponse } from "next/server";
import { commentStore } from "@/lib/commentStore";

const REPORT_RATE_LIMIT_WINDOW_MS = 60_000;
const REPORT_RATE_LIMIT_MAX = 3;
const reportRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkReportRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = reportRateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    reportRateLimitMap.set(ip, { count: 1, resetAt: now + REPORT_RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= REPORT_RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

// POST /api/campaigns/[campaignId]/comments/[commentId]/report
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string; commentId: string }> },
) {
  const { campaignId: campaignIdStr, commentId } = await params;
  const campaignId = parseInt(campaignIdStr, 10);
  if (isNaN(campaignId)) {
    return NextResponse.json({ message: "Invalid campaign ID" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  if (!checkReportRateLimit(ip)) {
    return NextResponse.json(
      { message: "Too many report requests. Please wait." },
      { status: 429 },
    );
  }

  const comments = commentStore.get(campaignId) ?? [];
  const idx = comments.findIndex((c) => c.id === commentId);
  if (idx === -1) {
    return NextResponse.json({ message: "Comment not found" }, { status: 404 });
  }

  comments[idx] = { ...comments[idx], isReported: true };
  commentStore.set(campaignId, comments);

  return NextResponse.json(comments[idx]);
}
