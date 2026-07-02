import { NextResponse } from "next/server";
import { IS_MOCK_MODE } from "@/lib/runtimeEnv";

export async function GET() {
  if (IS_MOCK_MODE) {
    return NextResponse.json([]);
  }

  // Real implementation will eventually go here
  // For now, in non-mock mode, we'll return an empty array too
  // to prevent 404s until the backend is fully wired up.
  return NextResponse.json([]);
}
