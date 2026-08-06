import { NextRequest, NextResponse } from "next/server";
import { pinImageToIpfs } from "@/lib/ipfsUpload";
import { validateImageFile } from "@/lib/imageValidation";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ message: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ message: "file is required" }, { status: 400 });
  }

  const validation = validateImageFile(file);
  if (!validation.valid) {
    return NextResponse.json(
      { message: validation.error ?? "Invalid image file" },
      { status: 400 },
    );
  }

  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "anon";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { message: "Too many uploads. Please wait before trying again." },
      { status: 429 },
    );
  }

  try {
    const url = await pinImageToIpfs(file, file.name || "cover-image");
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    const status = message.includes("not configured") ? 503 : 502;
    return NextResponse.json({ message }, { status });
  }
}
