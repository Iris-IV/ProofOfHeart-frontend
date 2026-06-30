import { NextRequest, NextResponse } from "next/server";
import { Comment } from "@/types";
import { commentStore } from "@/lib/commentStore";

const PAGE_SIZE = 20;
const MAX_CONTENT_LENGTH = 2000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

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

// GET /api/campaigns/[campaignId]/comments?page=1&pageSize=20
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const { campaignId: campaignIdStr } = await params;
  const campaignId = parseInt(campaignIdStr, 10);
  if (isNaN(campaignId)) {
    return NextResponse.json({ message: "Invalid campaign ID" }, { status: 400 });
  }

  const url = new URL(_req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("pageSize") ?? String(PAGE_SIZE), 10)),
  );

  const all = (commentStore.get(campaignId) ?? []).filter((c) => !c.isReported);
  const total = all.length;
  const items = all.slice((page - 1) * pageSize, page * pageSize);

  return NextResponse.json({ items, total, page, pageSize, hasMore: page * pageSize < total });
}

// POST /api/campaigns/[campaignId]/comments
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const { campaignId: campaignIdStr } = await params;
  const campaignId = parseInt(campaignIdStr, 10);
  if (isNaN(campaignId)) {
    return NextResponse.json({ message: "Invalid campaign ID" }, { status: 400 });
  }

  let body: {
    content?: string;
    authorAddress?: string;
    timestamp?: number;
    parentId?: string | null;
    signature?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { content, authorAddress, timestamp, parentId = null, signature } = body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json({ message: "Content is required" }, { status: 400 });
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { message: `Content must be at most ${MAX_CONTENT_LENGTH} characters` },
      { status: 400 },
    );
  }
  if (!authorAddress || typeof authorAddress !== "string") {
    return NextResponse.json({ message: "Author address is required" }, { status: 400 });
  }
  if (!signature || typeof signature !== "string") {
    return NextResponse.json({ message: "Signature is required" }, { status: 400 });
  }

  const rateLimitKey = `${authorAddress}:${campaignId}`;
  if (!checkRateLimit(rateLimitKey)) {
    return NextResponse.json(
      { message: "Too many requests. Please wait before posting again." },
      { status: 429 },
    );
  }

  const comment: Comment = {
    id: `comment-${campaignId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    campaignId,
    content: content.trim(),
    authorAddress,
    timestamp: typeof timestamp === "number" ? timestamp : Math.floor(Date.now() / 1000),
    parentId: parentId ?? null,
    signature,
    isPinned: false,
    isReported: false,
  };

  const existing = commentStore.get(campaignId) ?? [];
  commentStore.set(campaignId, [...existing, comment]);

  return NextResponse.json(comment, { status: 201 });
}
