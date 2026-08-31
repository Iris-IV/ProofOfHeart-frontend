import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter, rateLimitKeyFromRequest } from "@/lib/rateLimit";

const emailOptInRateLimiter = createRateLimiter(60_000, 10);

/** Matches the client-side email check in NewCauseClient. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, message: "Request body too large" }, { status: 400 });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  // body?. — JSON.parse("null") yields null; never dereference it directly.
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const campaignTitle = typeof body?.campaignTitle === "string" ? body.campaignTitle.trim() : "";

  // Validate required fields
  if (!email || !campaignTitle) {
    return NextResponse.json(
      { ok: false, message: "Missing required fields: email, campaignTitle" },
      { status: 400 },
    );
  }

  // Basic email format check (matches client-side validation)
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, message: "Invalid email format" }, { status: 400 });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        email,
        campaignTitle,
        source: "proof_of_heart_frontend",
        timestamp: body.timestamp ?? new Date().toISOString(),
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
