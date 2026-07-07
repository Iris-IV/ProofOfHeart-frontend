import { NextResponse } from "next/server";
import { processExpiringCampaigns, HOURS_BEFORE_DEADLINE } from "@/lib/campaignNotifications";

// Simple in-memory tracking for demo purposes
// In production, this should be replaced with a persistent database (Redis, database, etc.)
const notifiedCampaigns = new Set<number>();

// ---------------------------------------------------------------------------
// API Route Handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // Simple authentication check (in production, use proper auth)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webhookUrl = process.env.CREATOR_EMAIL_WEBHOOK_URL?.trim();

  if (!webhookUrl) {
    return NextResponse.json(
      { error: "CREATOR_EMAIL_WEBHOOK_URL not configured" },
      { status: 500 },
    );
  }

  try {
    const result = await processExpiringCampaigns(webhookUrl, notifiedCampaigns);

    if (result.campaigns.length === 0) {
      return NextResponse.json({
        message: "No campaigns expiring within warning window",
        notified: 0,
        failed: 0,
      });
    }

    return NextResponse.json({
      message: `Processed ${result.campaigns.length} expiring campaigns`,
      notified: result.notified,
      failed: result.failed,
      campaigns: result.campaigns.map((c) => ({
        id: c.id,
        title: c.title,
        hoursRemaining: c.hoursRemaining,
      })),
    });
  } catch (error) {
    console.error("Error in notify-expiring endpoint:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// Allow GET for health checks
export async function GET() {
  return NextResponse.json({
    status: "ok",
    warningWindow: `${HOURS_BEFORE_DEADLINE} hours`,
    description: "Endpoint for sending campaign expiry warnings",
    notifiedCount: notifiedCampaigns.size,
  });
}
