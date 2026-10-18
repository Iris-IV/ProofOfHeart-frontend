import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const NotifySchema = z.object({
  email: z.string().email(),
  campaignId: z.number().int().nullable().optional(),
  campaignTitle: z.string().min(1).max(200),
  creatorAddress: z.string().min(1),
});

const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const ipHits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || now > entry.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (entry.count >= MAX_PER_WINDOW) return true;
  entry.count += 1;
  return false;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = NotifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }

  const webhookUrl = process.env.CREATOR_EMAIL_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    console.warn("[notify-creator] CREATOR_EMAIL_WEBHOOK_URL not configured — skipping");
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const url = new URL(webhookUrl);
    if (!["https:", "http:"].includes(url.protocol)) {
      return NextResponse.json({ error: "Invalid webhook URL protocol" }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid webhook URL" }, { status: 500 });
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "campaign_creator_email_opt_in",
        ...parsed.data,
        source: "proof_of_heart_frontend",
        timestamp: new Date().toISOString(),
      }),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[notify-creator] webhook failed", e);
    return NextResponse.json({ error: "Webhook dispatch failed" }, { status: 502 });
  }
}
