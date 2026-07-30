import {
  escapeCsvCell,
  formatCsvDate,
  generateContributionHistoryCsv,
  exportContributionHistoryCsv,
} from "@/utils/exportCsv";
import { ContributionHistoryItem } from "@/hooks/useContributions";
import { Campaign, Category } from "@/types";

const CREATOR = "GCREATOR1111111111111111111111111111111111111111111111111";

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 1,
    creator: CREATOR,
    title: "Solar, Classroom Kits",
    description: "Solar classroom description.",
    created_at: 1_700_000_000,
    status: "active",
    funding_goal: BigInt(100_000_000),
    deadline: 1_710_000_000,
    amount_raised: BigInt(50_000_000),
    is_active: true,
    funds_withdrawn: false,
    is_cancelled: false,
    is_verified: false,
    category: Category.Learner,
    has_revenue_sharing: false,
    revenue_share_percentage: 0,
    ...overrides,
  };
}

describe("exportCsv utility", () => {
  describe("escapeCsvCell", () => {
    it("escapes cells containing commas, quotes, or newlines", () => {
      expect(escapeCsvCell('Hello "World"')).toBe('"Hello ""World"""');
      expect(escapeCsvCell("One, Two")).toBe('"One, Two"');
      expect(escapeCsvCell("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
      expect(escapeCsvCell("Normal text")).toBe("Normal text");
    });
  });

  describe("formatCsvDate", () => {
    it("formats epoch timestamp into ISO date time string", () => {
      const formatted = formatCsvDate(1_700_000_000_000);
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it("returns empty string for invalid timestamp", () => {
      expect(formatCsvDate(NaN)).toBe("");
      expect(formatCsvDate(0)).toBe("");
    });
  });

  describe("generateContributionHistoryCsv", () => {
    it("generates valid CSV string with required headers and formatted amounts", () => {
      const items: ContributionHistoryItem[] = [
        {
          campaign: makeCampaign({ id: 1, title: 'Clean "Water" Project' }),
          contribution: BigInt(250_000_000), // 25 XLM
          status: "active",
          canClaimRefund: false,
          canClaimRevenue: false,
          claimableRevenue: BigInt(0),
          transactions: [
            {
              walletAddress: "GCONTRIB1111111111111111111111111111111111111111111111111",
              campaignId: 1,
              action: "contribute",
              txHash: "HASH1234567890ABCDEF",
              timestamp: 1_700_000_000_000,
            },
          ],
        },
      ];

      const csv = generateContributionHistoryCsv(items);
      const lines = csv.split("\r\n");

      expect(lines[0]).toBe("Campaign,Amount (XLM),Status,Transaction Hash,Date");
      expect(lines[1]).toContain('"Clean ""Water"" Project"');
      expect(lines[1]).toContain("25");
      expect(lines[1]).toContain("HASH1234567890ABCDEF");
    });
  });

  describe("exportContributionHistoryCsv", () => {
    it("triggers file download in browser DOM environment", () => {
      const mockCreateObjectURL = jest.fn(() => "blob:http://localhost/mock-blob");
      const mockRevokeObjectURL = jest.fn();
      window.URL.createObjectURL = mockCreateObjectURL;
      window.URL.revokeObjectURL = mockRevokeObjectURL;

      const appendSpy = jest.spyOn(document.body, "appendChild");
      const removeSpy = jest.spyOn(document.body, "removeChild");

      const items: ContributionHistoryItem[] = [
        {
          campaign: makeCampaign(),
          contribution: BigInt(100_000_000),
          status: "active",
          canClaimRefund: false,
          canClaimRevenue: false,
          claimableRevenue: BigInt(0),
          transactions: [],
        },
      ];

      exportContributionHistoryCsv(
        items,
        "GCONTRIB1111111111111111111111111111111111111111111111111",
      );

      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
      expect(appendSpy).toHaveBeenCalledTimes(1);
      expect(removeSpy).toHaveBeenCalledTimes(1);
      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:http://localhost/mock-blob");
    });
  });
});
