import { NextRequest, NextResponse } from "next/server";
import { ingestObservabilityEvent } from "@/lib/observability/metricsStore";
import { createRateLimiter, rateLimitKeyFromRequest } from "@/lib/rateLimit";
import { ObservabilityEventBodySchema } from "@/lib/schemas";

const observabilityRateLimiter = createRateLimiter(60_000, 10);

/**
 * Check x-metrics-token against METRICS_SECRET_TOKEN.
 * If the env var is not set, the endpoint is effectively disabled.
 */
function requireMetricsAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.METRICS_SECRET_TOKEN;
  if (!secret) {
    return NextResponse.json({ message: "Observability is not configured" }, { status: 503 });
  }
  const token = req.headers.get("x-metrics-token");
  if (!token || token !== secret) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const authError = requireMetricsAuth(req);
  if (authError) return authError;

  const rateLimitKey = rateLimitKeyFromRequest(req);
  if (!observabilityRateLimiter.check(rateLimitKey)) {
    return NextResponse.json({ message: "Too many requests. Please slow down." }, { status: 429 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ObservabilityEventBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { message: firstIssue?.message ?? "Invalid observability event" },
      { status: 400 },
    );
  }

  const body = parsed.data;

  ingestObservabilityEvent({
    id: body.id ?? `srv-${Date.now()}`,
    timestamp: body.timestamp,
    category: body.category,
    kind: body.kind,
    operation: body.operation,
    contractErrorCode: body.contractErrorCode,
    contractErrorKey: body.contractErrorKey,
    message: body.message,
    network: body.network,
    rpcStatus: body.rpcStatus,
    txHash: body.txHash,
  });

  // Forward the event to the external webhook (server-side only, not exposed to browser).
  const webhookUrl = process.env.OBSERVABILITY_WEBHOOK_URL;
  if (webhookUrl) {
    forwardToWebhook(webhookUrl, body).catch(() => {
      // Non-fatal: metrics are still ingested locally.
    });
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}

async function forwardToWebhook(
  webhookUrl: string,
  event: typeof ObservabilityEventBodySchema._type,
): Promise<void> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    if (!response.ok) {
      console.error("[observability] Webhook responded with", response.status);
    }
  } catch (err) {
    console.error("[observability] Webhook forward failed:", err);
  }
}
