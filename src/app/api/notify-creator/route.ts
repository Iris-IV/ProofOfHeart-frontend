import { NextRequest, NextResponse } from "next/server";

const WEBHOOK_URL = process.env.CREATOR_EMAIL_WEBHOOK_URL?.trim() ?? "";

export async function POST(request: NextRequest) {
  if (!WEBHOOK_URL) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { email, campaignId, campaignTitle, creatorAddress } = body;

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    if (typeof campaignTitle !== "string" || campaignTitle.length > 100) {
      return NextResponse.json({ error: "Invalid title" }, { status: 400 });
    }

    if (typeof creatorAddress !== "string" || creatorAddress.length > 56) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "campaign_creator_email_opt_in",
        email,
        campaignId,
        campaignTitle,
        creatorAddress,
        source: "proof_of_heart_frontend",
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Webhook failed" }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}