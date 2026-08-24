import { NextRequest, NextResponse } from "next/server";
import { getObservabilityMetricsSnapshot } from "@/lib/observability/metricsStore";

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

export async function GET(req: NextRequest) {
  const authError = requireMetricsAuth(req);
  if (authError) return authError;

  const url = new URL(req.url);
  const windowMs = Number(url.searchParams.get("windowMs") ?? 5 * 60_000);
  const snapshot = getObservabilityMetricsSnapshot(
    Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 5 * 60_000,
  );
  return NextResponse.json(snapshot);
}
