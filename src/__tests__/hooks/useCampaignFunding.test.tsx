import { renderHook, waitFor } from "@testing-library/react";
import { useCampaignFunding } from "@/hooks/useCampaignFunding";
import { getCampaign } from "@/lib/contractClient";
import type { Campaign } from "@/types";

jest.mock("@/lib/contractClient");

const mockGetCampaign = getCampaign as jest.MockedFunction<typeof getCampaign>;

describe("useCampaignFunding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return null funding data when campaign is loading", () => {
    mockGetCampaign.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useCampaignFunding(1));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.fundingGoal).toBeNull();
    expect(result.current.amountRaised).toBeNull();
  });

  it("should return campaign funding fields and calculate percentage", async () => {
    const mockCampaign: Campaign = {
      id: 1,
      creator: "GTEST123",
      title: "Test",
      description: "Test",
      category: "health",
      created_at: 1234567890,
      status: "active",
      funding_goal: BigInt(1000),
      deadline: 9999999999,
      amount_raised: BigInt(750),
      is_active: true,
      funds_withdrawn: false,
      is_cancelled: false,
      is_verified: false,
      has_revenue_sharing: true,
      revenue_share_percentage: 300, // 3%
      milestones: [
        { targetAmount: BigInt(500), description: "Milestone 1" },
        { targetAmount: BigInt(1000), description: "Milestone 2" },
      ],
    };

    mockGetCampaign.mockResolvedValue(mockCampaign);

    const { result } = renderHook(() => useCampaignFunding(1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.fundingGoal).toBe(BigInt(1000));
    expect(result.current.amountRaised).toBe(BigInt(750));
    expect(result.current.fundingPercentage).toBe(75);
    expect(result.current.deadline).toBe(9999999999);
    expect(result.current.milestones).toHaveLength(2);
    expect(result.current.fundsWithdrawn).toBe(false);
    expect(result.current.hasRevenueSharing).toBe(true);
    expect(result.current.revenueSharePercentage).toBe(300);
  });

  it("should handle campaign with no milestones", async () => {
    const mockCampaign: Campaign = {
      id: 2,
      creator: "GTEST456",
      title: "Test",
      description: "Test",
      category: "technology",
      created_at: 1234567890,
      status: "active",
      funding_goal: BigInt(2000),
      deadline: 9999999999,
      amount_raised: BigInt(1000),
      is_active: true,
      funds_withdrawn: false,
      is_cancelled: false,
      is_verified: false,
      has_revenue_sharing: false,
      revenue_share_percentage: 0,
    };

    mockGetCampaign.mockResolvedValue(mockCampaign);

    const { result } = renderHook(() => useCampaignFunding(2));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.milestones).toEqual([]);
    expect(result.current.fundingPercentage).toBe(50);
  });
});
