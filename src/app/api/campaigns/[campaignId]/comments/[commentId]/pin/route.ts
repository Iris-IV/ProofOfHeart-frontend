import { NextRequest, NextResponse } from "next/server";
import { getCommentRepository } from "@/lib/commentRepository";

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
