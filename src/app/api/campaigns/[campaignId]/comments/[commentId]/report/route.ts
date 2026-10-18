import { NextRequest, NextResponse } from "next/server";
import { getCommentRepository } from "@/lib/commentRepository";
import { createRateLimiter, rateLimitKeyFromRequest } from "@/lib/rateLimit";

const commentReportRateLimiter = createRateLimiter("comment_reports", 60_000, 3);

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

  const rateLimitKey = rateLimitKeyFromRequest(req);
  if (!(await commentReportRateLimiter.check(rateLimitKey))) {
    return NextResponse.json(
      { message: "Too many report requests. Please wait." },
      { status: 429 },
    );
  }

  const updated = await getCommentRepository().update(campaignId, commentId, {
    isReported: true,
  });
  if (!updated) {
    return NextResponse.json({ message: "Comment not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
