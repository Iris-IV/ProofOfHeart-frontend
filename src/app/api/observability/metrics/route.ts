import { NextRequest, NextResponse } from 'next/server';
import { getObservabilityMetricsSnapshot } from '@/lib/observability/metricsStore';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const windowMs = Number(url.searchParams.get('windowMs') ?? 5 * 60_000);
  const snapshot = getObservabilityMetricsSnapshot(
    Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 5 * 60_000,
  );
  return NextResponse.json(snapshot);
}
