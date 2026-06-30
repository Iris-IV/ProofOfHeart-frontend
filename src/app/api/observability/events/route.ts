import { NextRequest, NextResponse } from "next/server";
import { ingestObservabilityEvent } from "@/lib/observability/metricsStore";
import type { ObservabilityEvent } from "@/lib/observability/types";

export async function POST(req: NextRequest) {
  let body: ObservabilityEvent;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.timestamp || !body?.kind || !body?.category) {
    return NextResponse.json({ message: "Missing required observability fields" }, { status: 400 });
  }

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

  return NextResponse.json({ ok: true }, { status: 202 });
}
