import { renderHook, waitFor } from "@testing-library/react";
import { useCampaignRules } from "@/hooks/useCampaignRules";
import { getCampaign } from "@/lib/contractClient";
import type { Campaign } from "@/types";

jest.mock("@/lib/contractClient");

const mockGetCampaign = getCampaign as jest.MockedFunction<typeof getCampaign>;

describe("useCampaignRules", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return false for all rules when campaign is loading", () => {
    mockGetCampaign.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useCampaignRules(1));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isActive).toBe(false);
    expect(result.current.canContribute).toBe(false);
  });

  it("should calculate canContribute correctly for active campaign", async () => {
    const futureDeadline = Math.floor(Date.now() / 1000) + 86400; // 1 day from now

    const mockCampaign: Campaign = {
      id: 1,
      creator: "GTEST123",
      title: "Test",
      description: "Test",
      category: "health",
      created_at: 1234567890,
      status: "active",
      funding_goal: BigInt(1000),
      deadline: futureDeadline,
      amount_raised: BigInt(500),
      is_active: true,
      funds_withdrawn: false,
      is_cancelled: false,
      is_verified: false,
      has_revenue_sharing: false,
      revenue_share_percentage: 0,
    };

    mockGetCampaign.mockResolvedValue(mockCampaign);

    const { result } = renderHook(() => useCampaignRules(1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.status).toBe("active");
    expect(result.current.isActive).toBe(true);
    expect(result.current.isCancelled).toBe(false);
    expect(result.current.isVerified).toBe(false);
    expect(result.current.canContribute).toBe(true);
    expect(result.current.canWithdraw).toBe(false);
  });

  it("should calculate canWithdraw correctly when deadline passed and funded", async () => {
    const pastDeadline = Math.floor(Date.now() / 1000) - 86400; // 1 day ago

    const mockCampaign: Campaign = {
      id: 2,
      creator: "GTEST456",
      title: "Test",
      description: "Test",
      category: "technology",
      created_at: 1234567890,
      status: "funded",
      funding_goal: BigInt(1000),
      deadline: pastDeadline,
      amount_raised: BigInt(1500),
      is_active: true,
      funds_withdrawn: false,
      is_cancelled: false,
      is_verified: false,
      has_revenue_sharing: false,
      revenue_share_percentage: 0,
    };

    mockGetCampaign.mockResolvedValue(mockCampaign);

    const { result } = renderHook(() => useCampaignRules(2));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.canContribute).toBe(false);
    expect(result.current.canWithdraw).toBe(true);
  });

  it("should not allow contribution when funding goal reached", async () => {
    const futureDeadline = Math.floor(Date.now() / 1000) + 86400;

    const mockCampaign: Campaign = {
      id: 3,
      creator: "GTEST789",
      title: "Test",
      description: "Test",
      category: "education",
      created_at: 1234567890,
      status: "funded",
      funding_goal: BigInt(1000),
      deadline: futureDeadline,
      amount_raised: BigInt(1000),
      is_active: true,
      funds_withdrawn: false,
      is_cancelled: false,
      is_verified: false,
      has_revenue_sharing: false,
      revenue_share_percentage: 0,
    };

    mockGetCampaign.mockResolvedValue(mockCampaign);

    const { result } = renderHook(() => useCampaignRules(3));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.canContribute).toBe(false);
  });
});
