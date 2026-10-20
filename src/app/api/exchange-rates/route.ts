import { NextResponse } from "next/server";
import { exchangeRatesSchema, hasFreshRates } from "@/lib/exchangeRates";

export const dynamic = "force-dynamic";

/** A fixed upstream URL avoids exposing an open proxy or sending wallet data. */
export async function GET() {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd,eur&include_last_updated_at=true",
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(5000) },
    );
    if (!response.ok) throw new Error("Quote provider unavailable");
    const body = await response.json();
    const rates = exchangeRatesSchema.parse(body?.stellar);
    if (!hasFreshRates(rates)) throw new Error("Quote expired");
    return NextResponse.json(rates, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
    });
  } catch {
    return NextResponse.json(
      { error: "Exchange rates unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
