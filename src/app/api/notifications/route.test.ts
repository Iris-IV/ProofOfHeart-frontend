import { GET, PATCH } from "./route";
import { NextRequest } from "next/server";
import * as notifications from "@/lib/notifications";
import * as stellar from "@/lib/stellar";

jest.mock("@/lib/runtimeEnv", () => ({
  IS_MOCK_MODE: false,
}));

jest.mock("@/lib/notifications");
jest.mock("@/lib/stellar");

describe("/api/notifications", () => {
  const mockFetchNotifications = notifications.fetchNotifications as jest.MockedFunction<typeof notifications.fetchNotifications>;
  const mockMarkNotificationRead = notifications.markNotificationRead as jest.MockedFunction<typeof notifications.markNotificationRead>;
  const mockMarkAllNotificationsRead = notifications.markAllNotificationsRead as jest.MockedFunction<typeof notifications.markAllNotificationsRead>;
  const mockNormalizeAddress = stellar.normalizeAddress as jest.MockedFunction<typeof stellar.normalizeAddress>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNormalizeAddress.mockImplementation((addr) => addr);
  });

  describe("GET", () => {
    it("returns 400 when walletAddress is missing", async () => {
      const request = new NextRequest(new URL("http://localhost/api/notifications"));
      const response = await GET(request);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe("walletAddress parameter is required");
    });

    it("returns 400 when wallet address is invalid", async () => {
      mockNormalizeAddress.mockReturnValue("");
      const request = new NextRequest(
        new URL("http://localhost/api/notifications?walletAddress=invalid")
      );
      const response = await GET(request);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe("Invalid wallet address");
    });

    it("fetches and returns notifications for valid address", async () => {
      const mockNotifications = [
        {
          id: "tx-123",
          type: "contribution_confirmed" as const,
          campaignId: 5,
          campaignTitle: "Campaign #5",
          message: "Contribution confirmed",
          href: "/causes/5",
          timestamp: Date.now(),
          read: false,
        },
      ];
      mockNormalizeAddress.mockReturnValue("GABCD");
      mockFetchNotifications.mockResolvedValue(mockNotifications);

      const request = new NextRequest(
        new URL("http://localhost/api/notifications?walletAddress=GABCD")
      );
      const response = await GET(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.notifications).toEqual(mockNotifications);
      expect(mockFetchNotifications).toHaveBeenCalledWith("GABCD", undefined);
    });

    it("returns 500 when fetchNotifications throws", async () => {
      mockNormalizeAddress.mockReturnValue("GABCD");
      mockFetchNotifications.mockRejectedValue(new Error("RPC error"));

      const request = new NextRequest(
        new URL("http://localhost/api/notifications?walletAddress=GABCD")
      );
      const response = await GET(request);
      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBe("Failed to fetch notifications");
    });

    it("accepts 'address' query parameter as an alias", async () => {
      mockNormalizeAddress.mockReturnValue("GABCD");
      mockFetchNotifications.mockResolvedValue([]);

      const request = new NextRequest(
        new URL("http://localhost/api/notifications?address=GABCD")
      );
      const response = await GET(request);
      expect(response.status).toBe(200);
      expect(mockFetchNotifications).toHaveBeenCalledWith("GABCD", undefined);
    });
  });

  describe("PATCH", () => {
    it("marks a single notification as read", async () => {
      mockNormalizeAddress.mockReturnValue("GABCD");
      mockMarkNotificationRead.mockResolvedValue(undefined);

      const request = new NextRequest(
        new URL("http://localhost/api/notifications"),
        {
          method: "PATCH",
          body: JSON.stringify({
            walletAddress: "GABCD",
            notificationId: "tx-123",
          }),
        }
      );

      const response = await PATCH(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.ok).toBe(true);
      expect(mockMarkNotificationRead).toHaveBeenCalledWith("GABCD", "tx-123");
    });

    it("marks multiple notifications as read", async () => {
      mockNormalizeAddress.mockReturnValue("GABCD");
      mockMarkAllNotificationsRead.mockResolvedValue(undefined);

      const request = new NextRequest(
        new URL("http://localhost/api/notifications"),
        {
          method: "PATCH",
          body: JSON.stringify({
            walletAddress: "GABCD",
            notificationIds: ["tx-123", "tx-456"],
          }),
        }
      );

      const response = await PATCH(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.ok).toBe(true);
      expect(mockMarkAllNotificationsRead).toHaveBeenCalledWith(
        "GABCD",
        [{ id: "tx-123" }, { id: "tx-456" }]
      );
    });

    it("returns 400 when walletAddress is missing", async () => {
      const request = new NextRequest(
        new URL("http://localhost/api/notifications"),
        {
          method: "PATCH",
          body: JSON.stringify({
            notificationId: "tx-123",
          }),
        }
      );

      const response = await PATCH(request);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe("walletAddress is required");
    });

    it("returns 400 when wallet address is invalid", async () => {
      mockNormalizeAddress.mockReturnValue("");

      const request = new NextRequest(
        new URL("http://localhost/api/notifications"),
        {
          method: "PATCH",
          body: JSON.stringify({
            walletAddress: "invalid",
            notificationId: "tx-123",
          }),
        }
      );

      const response = await PATCH(request);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe("Invalid wallet address");
    });

    it("returns 400 when neither notificationId nor notificationIds is provided", async () => {
      mockNormalizeAddress.mockReturnValue("GABCD");

      const request = new NextRequest(
        new URL("http://localhost/api/notifications"),
        {
          method: "PATCH",
          body: JSON.stringify({
            walletAddress: "GABCD",
          }),
        }
      );

      const response = await PATCH(request);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe("Either notificationId or notificationIds is required");
    });

    it("returns 500 when marking notification read fails", async () => {
      mockNormalizeAddress.mockReturnValue("GABCD");
      mockMarkNotificationRead.mockRejectedValue(new Error("Database error"));

      const request = new NextRequest(
        new URL("http://localhost/api/notifications"),
        {
          method: "PATCH",
          body: JSON.stringify({
            walletAddress: "GABCD",
            notificationId: "tx-123",
          }),
        }
      );

      const response = await PATCH(request);
      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBe("Failed to mark notifications as read");
    });
  });
});
