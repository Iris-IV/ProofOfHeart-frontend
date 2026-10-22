import {
  NOTIFICATION_TOAST_TYPES,
  getNewlyArrivedNotifications,
  shouldToastNotification,
  type AppNotification,
  type NotificationEventType,
} from "@/lib/notifications";

function notification(id: string, overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id,
    type: "contribution_confirmed",
    campaignId: 1,
    campaignTitle: "Campaign #1",
    message: `Notification ${id}`,
    href: "/causes/1",
    timestamp: 1000,
    read: false,
    ...overrides,
  };
}

const instantInApp = { frequency: "instant" as const, channels: ["inApp" as const] };

describe("getNewlyArrivedNotifications", () => {
  it("returns nothing on the first load so the backlog is not toasted", () => {
    expect(getNewlyArrivedNotifications(null, [notification("a")])).toEqual([]);
  });

  it("returns unread notifications that were not seen before, newest first", () => {
    const previous = [notification("a")];
    const next = [
      notification("a"),
      notification("b", { timestamp: 2000 }),
      notification("c", { timestamp: 3000 }),
      notification("d", { read: true }),
    ];
    expect(getNewlyArrivedNotifications(previous, next).map((n) => n.id)).toEqual(["c", "b"]);
  });
});

describe("shouldToastNotification", () => {
  it("only toasts for instant in-app delivery", () => {
    const n = notification("a");
    expect(shouldToastNotification(n, instantInApp)).toBe(true);
    expect(shouldToastNotification(n, { ...instantInApp, frequency: "daily" })).toBe(false);
    expect(shouldToastNotification(n, { frequency: "instant", channels: ["email"] })).toBe(false);
  });

  it.each([
    ["contribution_confirmed", "contributions"],
    ["campaign_verified", "verified"],
    ["refund_available", "refundAvailable"],
    ["revenue_deposited", "revenueDeposited"],
  ] as const)("respects the %s switch (%s)", (type, pref) => {
    const n = notification("a", { type });
    expect(shouldToastNotification(n, { ...instantInApp, [pref]: false })).toBe(false);
    expect(shouldToastNotification(n, { ...instantInApp, [pref]: true })).toBe(true);
  });

  it("always toasts events without their own switch", () => {
    expect(
      shouldToastNotification(notification("a", { type: "campaign_funded" }), {
        ...instantInApp,
        contributions: false,
      }),
    ).toBe(true);
  });
});

describe("NOTIFICATION_TOAST_TYPES", () => {
  it("maps every event type, with cancellations as warnings", () => {
    const types: NotificationEventType[] = [
      "contribution_confirmed",
      "campaign_funded",
      "campaign_cancelled",
      "refund_available",
      "revenue_deposited",
      "revenue_claimed",
      "new_update",
      "campaign_verified",
    ];
    for (const type of types) expect(NOTIFICATION_TOAST_TYPES[type]).toBeDefined();
    expect(NOTIFICATION_TOAST_TYPES.campaign_cancelled).toBe("warning");
  });
});
