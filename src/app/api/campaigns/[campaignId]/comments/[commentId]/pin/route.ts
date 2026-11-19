import { NextRequest, NextResponse } from "next/server";
import { getCommentRepository } from "@/lib/commentRepository";
import { getCampaign } from "@/lib/contractClient";
import { requireCreatorOrAdmin } from "@/lib/adminAuth";
import { createRateLimiter, rateLimitKeyFromRequest } from "@/lib/rateLimit";

const pinRateLimiter = createRateLimiter("comment_pin", 60_000, 30);

// POST /api/campaigns/[campaignId]/comments/[commentId]/pin
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string; commentId: string }> },
) {
  const { campaignId: campaignIdStr, commentId } = await params;
  const campaignId = parseInt(campaignIdStr, 10);
  if (isNaN(campaignId)) {
    return NextResponse.json({ message: "Invalid campaign ID" }, { status: 400 });
  }

  if (!(await pinRateLimiter.check(rateLimitKeyFromRequest(req)))) {
    return NextResponse.json({ message: "Too many requests. Please wait." }, { status: 429 });
  }

  // Only the campaign creator (or the platform admin) may pin or unpin. The creator comes from the contract.
  const campaign = await getCampaign(campaignId).catch(() => null);
  if (!campaign) {
    return NextResponse.json({ message: "Campaign not found" }, { status: 404 });
  }
  const auth = await requireCreatorOrAdmin(req, campaign.creator);
  if (!auth.ok) return auth.response;

  let body: { isPinned?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { isPinned } = body;
  if (typeof isPinned !== "boolean") {
    return NextResponse.json({ message: "isPinned must be a boolean" }, { status: 400 });
  }

  const updated = await getCommentRepository().update(campaignId, commentId, { isPinned });
  if (!updated) {
    return NextResponse.json({ message: "Comment not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
