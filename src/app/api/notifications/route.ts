import { NextResponse, NextRequest } from "next/server";
import { IS_MOCK_MODE } from "@/lib/runtimeEnv";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/notifications";
import { normalizeAddress } from "@/lib/stellar";

export async function GET(request: NextRequest) {
  if (IS_MOCK_MODE) {
    return NextResponse.json([]);
  }

  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get("walletAddress") || searchParams.get("address");

  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress parameter is required" }, { status: 400 });
  }

  const normalized = normalizeAddress(walletAddress);
  if (!normalized) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  try {
    const notifications = await fetchNotifications(normalized);
    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (IS_MOCK_MODE) {
    return NextResponse.json({ ok: true });
  }

  try {
    const body = await request.json();
    const { walletAddress, notificationId, notificationIds } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
    }

    const normalized = normalizeAddress(walletAddress);
    if (!normalized) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    if (notificationIds && Array.isArray(notificationIds)) {
      // Mark multiple notifications as read
      const notifications = notificationIds.map((id) => ({ id })) as Array<{ id: string }>;
      await markAllNotificationsRead(normalized, notifications as never);
      return NextResponse.json({ ok: true });
    } else if (notificationId) {
      // Mark a single notification as read
      await markNotificationRead(normalized, notificationId);
      return NextResponse.json({ ok: true });
    } else {
      return NextResponse.json(
        { error: "Either notificationId or notificationIds is required" },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    return NextResponse.json({ error: "Failed to mark notifications as read" }, { status: 500 });
  }
}
