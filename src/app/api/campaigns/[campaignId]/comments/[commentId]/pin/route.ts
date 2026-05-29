import { NextRequest, NextResponse } from "next/server";

// Shared store reference — imported via the parent module in a real DB setup.
// For now we re-use the in-memory map via a module-level import trick.
import { commentStore } from "@/lib/commentStore";

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

  const comments = commentStore.get(campaignId) ?? [];
  const idx = comments.findIndex((c) => c.id === commentId);
  if (idx === -1) {
    return NextResponse.json({ message: "Comment not found" }, { status: 404 });
  }

  comments[idx] = { ...comments[idx], isPinned };
  commentStore.set(campaignId, comments);

  return NextResponse.json(comments[idx]);
}
