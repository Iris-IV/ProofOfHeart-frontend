import {
  isWithinWarningWindow,
  calculateHoursRemaining,
  calculateFundingPercentage,
  fetchExpiringCampaigns,
  sendCampaignNotification,
  processExpiringCampaigns,
  HOURS_BEFORE_DEADLINE,
} from "@/lib/campaignNotifications";

// Mock the contract client
jest.mock("@/lib/contractClient", () => ({
  getCampaignCount: jest.fn(),
  getCampaign: jest.fn(),
}));

const mockGetCampaignCount = jest.mocked(require("@/lib/contractClient").getCampaignCount);
const mockGetCampaign = jest.mocked(require("@/lib/contractClient").getCampaign);

describe("campaignNotifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock current time to a fixed timestamp for consistent testing
    jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000); // 2023-11-14
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("isWithinWarningWindow", () => {
    it("returns true when deadline is exactly 48 hours away", () => {
      const deadline = Math.floor(Date.now() / 1000) + HOURS_BEFORE_DEADLINE * 3600;
      expect(isWithinWarningWindow(deadline)).toBe(true);
    });

    it("returns true when deadline is within 48 hours", () => {
      const deadline = Math.floor(Date.now() / 1000) + 24 * 3600; // 24 hours
      expect(isWithinWarningWindow(deadline)).toBe(true);
    });

    it("returns false when deadline is more than 48 hours away", () => {
      const deadline = Math.floor(Date.now() / 1000) + 72 * 3600; // 72 hours
      expect(isWithinWarningWindow(deadline)).toBe(false);
    });

    it("returns false when deadline has already passed", () => {
      const deadline = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      expect(isWithinWarningWindow(deadline)).toBe(false);
    });
  });

  describe("calculateHoursRemaining", () => {
    it("calculates hours remaining correctly", () => {
      const deadline = Math.floor(Date.now() / 1000) + 24 * 3600;
      expect(calculateHoursRemaining(deadline)).toBe(24);
    });

    it("returns 0 when deadline has passed", () => {
      const deadline = Math.floor(Date.now() / 1000) - 3600;
      expect(calculateHoursRemaining(deadline)).toBe(0);
    });

    it("handles fractional hours by flooring", () => {
      const deadline = Math.floor(Date.now() / 1000) + 25 * 3600 + 1800; // 25.5 hours
      expect(calculateHoursRemaining(deadline)).toBe(25);
    });
  });

  describe("calculateFundingPercentage", () => {
    it("calculates percentage correctly", () => {
      expect(calculateFundingPercentage(BigInt(50), BigInt(100))).toBe(50);
      expect(calculateFundingPercentage(BigInt(75), BigInt(100))).toBe(75);
    });

    it("caps at 100%", () => {
      expect(calculateFundingPercentage(BigInt(150), BigInt(100))).toBe(100);
    });

    it("returns 0 when funding goal is 0", () => {
      expect(calculateFundingPercentage(BigInt(50), BigInt(0))).toBe(0);
    });

    it("handles bigint arithmetic correctly", () => {
      expect(calculateFundingPercentage(BigInt(1), BigInt(3))).toBe(33);
    });
  });

  describe("fetchExpiringCampaigns", () => {
    it("fetches campaigns within warning window", async () => {
      const now = Math.floor(Date.now() / 1000);
      const warningDeadline = now + 24 * 3600; // 24 hours from now
      const futureDeadline = now + 72 * 3600; // 72 hours from now

      mockGetCampaignCount.mockResolvedValue(2);
      mockGetCampaign
        .mockResolvedValueOnce({
          id: 1,
          title: "Expiring Campaign",
          creator: "GTEST1",
          deadline: warningDeadline,
          amount_raised: BigInt(50_000_000),
          funding_goal: BigInt(100_000_000),
          is_active: true,
          funds_withdrawn: false,
          is_cancelled: false,
          is_verified: false,
          category: 0,
          has_revenue_sharing: false,
          revenue_share_percentage: 0,
        })
        .mockResolvedValueOnce({
          id: 2,
          title: "Future Campaign",
          creator: "GTEST2",
          deadline: futureDeadline,
          amount_raised: BigInt(50_000_000),
          funding_goal: BigInt(100_000_000),
          is_active: true,
          funds_withdrawn: false,
          is_cancelled: false,
          is_verified: false,
          category: 0,
          has_revenue_sharing: false,
          revenue_share_percentage: 0,
        });

      const result = await fetchExpiringCampaigns();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].title).toBe("Expiring Campaign");
    });

    it("excludes already funded campaigns", async () => {
      const now = Math.floor(Date.now() / 1000);
      const warningDeadline = now + 24 * 3600;

      mockGetCampaignCount.mockResolvedValue(1);
      mockGetCampaign.mockResolvedValue({
        id: 1,
        title: "Funded Campaign",
        creator: "GTEST1",
        deadline: warningDeadline,
        amount_raised: BigInt(100_000_000),
        funding_goal: BigInt(100_000_000),
        is_active: true,
        funds_withdrawn: false,
        is_cancelled: false,
        is_verified: false,
        category: 0,
        has_revenue_sharing: false,
        revenue_share_percentage: 0,
      });

      const result = await fetchExpiringCampaigns();

      expect(result).toHaveLength(0);
    });

    it("excludes already notified campaigns when tracking is provided", async () => {
      const now = Math.floor(Date.now() / 1000);
      const warningDeadline = now + 24 * 3600;
      const notified = new Set<number>([1]);

      mockGetCampaignCount.mockResolvedValue(1);
      mockGetCampaign.mockResolvedValue({
        id: 1,
        title: "Already Notified",
        creator: "GTEST1",
        deadline: warningDeadline,
        amount_raised: BigInt(50_000_000),
        funding_goal: BigInt(100_000_000),
        is_active: true,
        funds_withdrawn: false,
        is_cancelled: false,
        is_verified: false,
        category: 0,
        has_revenue_sharing: false,
        revenue_share_percentage: 0,
      });

      const result = await fetchExpiringCampaigns(notified);

      expect(result).toHaveLength(0);
    });

    it("handles null campaigns gracefully", async () => {
      mockGetCampaignCount.mockResolvedValue(1);
      mockGetCampaign.mockResolvedValue(null);

      const result = await fetchExpiringCampaigns();

      expect(result).toHaveLength(0);
    });
  });

  describe("sendCampaignNotification", () => {
    it("sends notification to webhook", async () => {
      const mockFetch = jest.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch;

      const campaign = {
        id: 1,
        title: "Test Campaign",
        creator: "GTEST1",
        deadline: 1_700_000_000 + 24 * 3600,
        amountRaised: BigInt(50_000_000),
        fundingGoal: BigInt(100_000_000),
        isFunded: false,
        hoursRemaining: 24,
      };

      await sendCampaignNotification(campaign, "https://example.com/webhook");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/webhook",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining("campaign_expiry_warning"),
        }),
      );
    });

    it("throws error when webhook fails", async () => {
      const mockFetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
      global.fetch = mockFetch;

      const campaign = {
        id: 1,
        title: "Test Campaign",
        creator: "GTEST1",
        deadline: 1_700_000_000 + 24 * 3600,
        amountRaised: BigInt(50_000_000),
        fundingGoal: BigInt(100_000_000),
        isFunded: false,
        hoursRemaining: 24,
      };

      await expect(
        sendCampaignNotification(campaign, "https://example.com/webhook"),
      ).rejects.toThrow("Webhook returned 500");
    });
  });

  describe("processExpiringCampaigns", () => {
    it("processes and notifies expiring campaigns", async () => {
      const now = Math.floor(Date.now() / 1000);
      const warningDeadline = now + 24 * 3600;

      mockGetCampaignCount.mockResolvedValue(1);
      mockGetCampaign.mockResolvedValue({
        id: 1,
        title: "Expiring Campaign",
        creator: "GTEST1",
        deadline: warningDeadline,
        amount_raised: BigInt(50_000_000),
        funding_goal: BigInt(100_000_000),
        is_active: true,
        funds_withdrawn: false,
        is_cancelled: false,
        is_verified: false,
        category: 0,
        has_revenue_sharing: false,
        revenue_share_percentage: 0,
      });

      const mockFetch = jest.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch;

      const notified = new Set<number>();
      const result = await processExpiringCampaigns("https://example.com/webhook", notified);

      expect(result.notified).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.campaigns).toHaveLength(1);
      expect(notified.has(1)).toBe(true);
    });

    it("returns empty result when no campaigns expiring", async () => {
      mockGetCampaignCount.mockResolvedValue(0);

      const result = await processExpiringCampaigns("https://example.com/webhook");

      expect(result.notified).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.campaigns).toHaveLength(0);
    });

    it("handles partial failures gracefully", async () => {
      const now = Math.floor(Date.now() / 1000);
      const warningDeadline = now + 24 * 3600;

      mockGetCampaignCount.mockResolvedValue(2);
      mockGetCampaign
        .mockResolvedValueOnce({
          id: 1,
          title: "Campaign 1",
          creator: "GTEST1",
          deadline: warningDeadline,
          amount_raised: BigInt(50_000_000),
          funding_goal: BigInt(100_000_000),
          is_active: true,
          funds_withdrawn: false,
          is_cancelled: false,
          is_verified: false,
          category: 0,
          has_revenue_sharing: false,
          revenue_share_percentage: 0,
        })
        .mockResolvedValueOnce({
          id: 2,
          title: "Campaign 2",
          creator: "GTEST2",
          deadline: warningDeadline,
          amount_raised: BigInt(50_000_000),
          funding_goal: BigInt(100_000_000),
          is_active: true,
          funds_withdrawn: false,
          is_cancelled: false,
          is_verified: false,
          category: 0,
          has_revenue_sharing: false,
          revenue_share_percentage: 0,
        });

      const mockFetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: true })
        .mockRejectedValueOnce(new Error("Network error"));
      global.fetch = mockFetch;

      const notified = new Set<number>();
      const result = await processExpiringCampaigns("https://example.com/webhook", notified);

      expect(result.notified).toBe(1);
      expect(result.failed).toBe(1);
      expect(notified.has(1)).toBe(true);
      expect(notified.has(2)).toBe(false);
    });
  });
});
