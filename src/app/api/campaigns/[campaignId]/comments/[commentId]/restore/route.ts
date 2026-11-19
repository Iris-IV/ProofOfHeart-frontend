import { NextRequest, NextResponse } from "next/server";
import { getCommentRepository } from "@/lib/commentRepository";

/**
 * POST /api/campaigns/[campaignId]/comments/[commentId]/restore
 *
 * Moderator endpoint: clears the under-review flag and resets the report
 * counter on a comment, making it fully visible again (#1877).
 *
 * Authentication is left to the calling layer (middleware or future auth
 * guard); this route itself only validates the shape of the request.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ campaignId: string; commentId: string }> },
) {
  const { campaignId: campaignIdStr, commentId } = await params;
  const campaignId = parseInt(campaignIdStr, 10);
  if (isNaN(campaignId)) {
    return NextResponse.json({ message: "Invalid campaign ID" }, { status: 400 });
  }

  const updated = await getCommentRepository().update(campaignId, commentId, {
    isUnderReview: false,
    isReported: false,
    reportCount: 0,
  });
  if (!updated) {
    return NextResponse.json({ message: "Comment not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
