import { NextRequest, NextResponse } from "next/server";
import { getCommentRepository } from "@/lib/commentRepository";
import { createRateLimiter, rateLimitKeyFromRequest } from "@/lib/rateLimit";

const commentReportRateLimiter = createRateLimiter("comment_reports", 60_000, 3);

/**
 * Number of reports required before a comment is flagged for moderator
 * review. Below this threshold the comment is shown without restriction
 * (#1877).
 */
export const COMMENT_REPORT_THRESHOLD = 3;

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

  const repo = getCommentRepository();
  const comment = await repo.find(campaignId, commentId);
  if (!comment) {
    return NextResponse.json({ message: "Comment not found" }, { status: 404 });
  }

  const newCount = (comment.reportCount ?? 0) + 1;
  const crossedThreshold = newCount >= COMMENT_REPORT_THRESHOLD;

  const updated = await repo.update(campaignId, commentId, {
    reportCount: newCount,
    isUnderReview: crossedThreshold || comment.isUnderReview,
    // Keep legacy flag in sync so old code paths that read isReported still
    // see a truthy value once the threshold is reached.
    isReported: crossedThreshold || comment.isReported,
  });
  if (!updated) {
    return NextResponse.json({ message: "Comment not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
