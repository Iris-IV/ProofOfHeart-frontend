import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter, rateLimitKeyFromRequest } from "@/lib/rateLimit";
import { EmailOptInBodySchema } from "@/lib/schemas";

const emailOptInRateLimiter = createRateLimiter(60_000, 10);

/** Maximum accepted request body size (bytes). */
const MAX_BODY_BYTES = 16 * 1024;

/**
 * POST /api/email-opt-in
 *
 * Forwards a campaign creator email opt-in event to the configured
 * webhook URL. The webhook URL is read server-side so it is never
 * exposed to the browser bundle.
 *
 * All responses share the `{ ok, message }` shape.
 */
export async function POST(req: NextRequest) {
  const rateLimitKey = rateLimitKeyFromRequest(req);
  if (!emailOptInRateLimiter.check(rateLimitKey)) {
    return NextResponse.json(
      { ok: false, message: "Too many requests. Please slow down." },
      { status: 429 },
    );
  }

  const webhookUrl = process.env.CREATOR_EMAIL_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ ok: false, message: "Webhook not configured" }, { status: 501 });
  }

  let rawBody: unknown;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, message: "Request body too large" }, { status: 400 });
    }
    rawBody = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = EmailOptInBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { ok: false, message: firstIssue?.message ?? "Invalid request body" },
      { status: 400 },
    );
  }

  const { email, campaignTitle, timestamp } = parsed.data;

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(typeof rawBody === "object" && rawBody !== null ? rawBody : {}),
        email,
        campaignTitle,
        source: "proof_of_heart_frontend",
        timestamp: timestamp ?? new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.error("[email-opt-in] Webhook responded with", response.status);
      return NextResponse.json({ ok: false, message: "Webhook request failed" }, { status: 502 });
    }

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (err) {
    console.error("[email-opt-in] Failed to forward event:", err);
    return NextResponse.json({ ok: false, message: "Webhook request failed" }, { status: 502 });
  }
}
