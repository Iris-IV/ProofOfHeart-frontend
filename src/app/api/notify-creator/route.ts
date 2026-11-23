import * as StellarSdk from "@stellar/stellar-sdk";
import { randomUUID } from "node:crypto";
import { getCampaign } from "@/lib/contractClient";
import { getKeyValueStore } from "@/lib/persistentStore";
import { createRateLimiter, getClientIp } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const NotifySchema = z.object({
  email: z.string().email(),
  campaignId: z.number().int().positive(),
  campaignTitle: z.string().min(1).max(200),
  creatorAddress: z.string().regex(/^G[A-Z2-7]{55}$/),
});

const notifyRateLimiter = createRateLimiter("creator_email_notify", 60_000, 5);
const CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000;
const SIGNATURE_MAX_AGE_SECONDS = 5 * 60;
interface PendingSubscription {
  email: string;
  campaignId: number;
  campaignTitle: string;
  creatorAddress: string;
  expiresAt: number;
}

function verifyNotifySignature(request: Request, body: unknown, creatorAddress: string): boolean {
  const walletAddress = request.headers.get("x-wallet-address");
  const signature = request.headers.get("x-request-signature");
  const timestampHeader = request.headers.get("x-request-timestamp");
  const purpose = request.headers.get("x-request-purpose");
  const timestamp = Number(timestampHeader);
  if (
    walletAddress !== creatorAddress ||
    !signature ||
    purpose !== "notify-creator" ||
    !Number.isInteger(timestamp) ||
    Math.abs(Math.floor(Date.now() / 1000) - timestamp) > SIGNATURE_MAX_AGE_SECONDS
  ) {
    return false;
  }

  try {
    const envelope = {
      purpose,
      timestamp,
      payload: {
        path: "/api/notify-creator",
        method: "POST",
        timestamp,
        payload: body,
      },
    };
    const payloadHash = StellarSdk.hash(Buffer.from(JSON.stringify(envelope)));
    return StellarSdk.verify(
      payloadHash,
      Buffer.from(signature, "hex"),
      StellarSdk.StrKey.decodeEd25519PublicKey(creatorAddress),
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!(await notifyRateLimiter.check(getClientIp(request)))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = NotifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }

  if (!verifyNotifySignature(request, parsed.data, parsed.data.creatorAddress)) {
    return NextResponse.json({ error: "A valid creator wallet signature is required" }, { status: 401 });
  }

  const campaign = await getCampaign(parsed.data.campaignId).catch(() => null);
  if (!campaign || campaign.creator !== parsed.data.creatorAddress) {
    return NextResponse.json({ error: "Campaign does not belong to creator" }, { status: 403 });
  }

  const webhookUrl = process.env.CREATOR_EMAIL_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    console.warn("[notify-creator] CREATOR_EMAIL_WEBHOOK_URL not configured — skipping");
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const url = new URL(webhookUrl);
    if (!["https:", "http:"].includes(url.protocol)) {
      return NextResponse.json({ error: "Invalid webhook URL protocol" }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid webhook URL" }, { status: 500 });
  }

  try {
    const token = randomUUID();
    const pending: PendingSubscription = {
      ...parsed.data,
      expiresAt: Date.now() + CONFIRMATION_TTL_MS,
    };
    await getKeyValueStore().set(`creator-email-confirmation:${token}`, pending);
    const confirmationUrl = new URL("/api/notify-creator", request.url);
    confirmationUrl.searchParams.set("token", token);

    const webhookRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({
        event: "campaign_creator_email_opt_in",
        status: "pending_confirmation",
        ...pending,
        confirmationUrl: confirmationUrl.toString(),
        source: "proof_of_heart_frontend",
        timestamp: new Date().toISOString(),
      }),
    });
    if (!webhookRes.ok) {
      console.error("[notify-creator] webhook returned non-2xx", webhookRes.status);
      return NextResponse.json({ error: "Webhook dispatch failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, pendingConfirmation: true }, { status: 202 });
  } catch (e) {
    console.error("[notify-creator] webhook failed", e);
    return NextResponse.json({ error: "Webhook dispatch failed" }, { status: 502 });
  }
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Confirmation token is required" }, { status: 400 });

  const store = getKeyValueStore();
  const key = `creator-email-confirmation:${token}`;
  const pending = await store.get<PendingSubscription>(key);
  if (!pending || pending.expiresAt < Date.now()) {
    return NextResponse.json({ error: "Confirmation token is invalid or expired" }, { status: 400 });
  }

  const webhookUrl = process.env.CREATOR_EMAIL_WEBHOOK_URL?.trim();
  if (!webhookUrl) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });

  try {
    const confirmRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({
        event: "campaign_creator_email_opt_in",
        status: "confirmed",
        ...pending,
        source: "proof_of_heart_frontend",
        timestamp: new Date().toISOString(),
      }),
    });
    if (!confirmRes.ok) {
      console.error("[notify-creator] confirmation webhook returned non-2xx", confirmRes.status);
      return NextResponse.json({ error: "Webhook dispatch failed" }, { status: 502 });
    }
    await store.delete(key);
    return NextResponse.json({ ok: true, confirmed: true });
  } catch (error) {
    console.error("[notify-creator] confirmation webhook failed", error);
    return NextResponse.json({ error: "Webhook dispatch failed" }, { status: 502 });
  }
}
