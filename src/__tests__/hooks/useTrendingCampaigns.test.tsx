import { renderHook } from "@testing-library/react";
import { useTrendingCampaigns } from "@/hooks/useTrendingCampaigns";
import { Category, type Campaign } from "@/types";

jest.mock("@/hooks/useCampaigns", () => ({
  useCampaigns: jest.fn(),
}));

import { useCampaigns } from "@/hooks/useCampaigns";

const mockUseCampaigns = useCampaigns as jest.MockedFunction<typeof useCampaigns>;

function makeCampaign(id: number, overrides: Partial<Campaign> = {}): Campaign {
  return {
    id,
    creator: "GCREATOR1111111111111111111111111111111111111111111111111",
    title: `Campaign ${id}`,
    description: "Desc",
    created_at: Math.floor(Date.now() / 1000) - 86400,
    status: "active",
    funding_goal: BigInt(100_000_000),
    deadline: Math.floor(Date.now() / 1000) + 86400,
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

describe("useTrendingCampaigns", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCampaigns.mockReturnValue({
      campaigns: [],
      isLoading: false,
      isRefreshing: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  it("returns campaigns sorted by trending score", () => {
    const c1 = makeCampaign(1, { title: "Low", amount_raised: BigInt(10_000_000) });
    const c2 = makeCampaign(2, { title: "High", amount_raised: BigInt(90_000_000) });
    mockUseCampaigns.mockReturnValue({
      campaigns: [c1, c2],
      isLoading: false,
      isRefreshing: false,
      error: null,
      refetch: jest.fn(),
    });

    const { result } = renderHook(() => useTrendingCampaigns(3));

    expect(result.current.trendingCampaigns).toHaveLength(2);
    expect(result.current.trendingCampaigns[0].title).toBe("High");
    expect(result.current.trendingCampaigns[1].title).toBe("Low");
  });

  it("returns empty array when no campaigns exist", () => {
    const { result } = renderHook(() => useTrendingCampaigns(3));

    expect(result.current.trendingCampaigns).toEqual([]);
  });

  it("preserves stable trendingCampaigns reference when deps do not change", () => {
    const c1 = makeCampaign(1, { amount_raised: BigInt(50_000_000) });
    const campaigns = [c1];

    mockUseCampaigns.mockReturnValue({
      campaigns,
      isLoading: false,
      isRefreshing: false,
      error: null,
      refetch: jest.fn(),
    });

    const { result, rerender } = renderHook(() => useTrendingCampaigns(3));

    const firstRef = result.current.trendingCampaigns;
    rerender();
    const secondRef = result.current.trendingCampaigns;

    expect(secondRef).toBe(firstRef);
  });

  it("produces a new trendingCampaigns array when campaigns reference changes", () => {
    const c1 = makeCampaign(1, { amount_raised: BigInt(50_000_000) });
    const campaignsA = [c1];

    mockUseCampaigns.mockReturnValue({
      campaigns: campaignsA,
      isLoading: false,
      isRefreshing: false,
      error: null,
      refetch: jest.fn(),
    });

    const { result, rerender } = renderHook(() => useTrendingCampaigns(3));

    const firstRef = result.current.trendingCampaigns;

    const c2 = makeCampaign(2, { amount_raised: BigInt(80_000_000) });
    const campaignsB = [c1, c2];
    mockUseCampaigns.mockReturnValue({
      campaigns: campaignsB,
      isLoading: false,
      isRefreshing: false,
      error: null,
      refetch: jest.fn(),
    });

    rerender();

    expect(result.current.trendingCampaigns).not.toBe(firstRef);
    expect(result.current.trendingCampaigns).toHaveLength(2);
  });

  it("produces a new trendingCampaigns array when limit changes", () => {
    const c1 = makeCampaign(1, { amount_raised: BigInt(50_000_000) });
    const c2 = makeCampaign(2, { amount_raised: BigInt(80_000_000) });
    const c3 = makeCampaign(3, { amount_raised: BigInt(30_000_000) });
    const campaigns = [c1, c2, c3];

    mockUseCampaigns.mockReturnValue({
      campaigns,
      isLoading: false,
      isRefreshing: false,
      error: null,
      refetch: jest.fn(),
    });

    const { result, rerender } = renderHook((limit: number) => useTrendingCampaigns(limit), {
      initialProps: 3,
    });

    expect(result.current.trendingCampaigns).toHaveLength(3);

    rerender(1);

    expect(result.current.trendingCampaigns).toHaveLength(1);
  });

  it("passes through isLoading, error, and refetch from useCampaigns", () => {
    const refetch = jest.fn();
    mockUseCampaigns.mockReturnValue({
      campaigns: [],
      isLoading: true,
      isRefreshing: false,
      error: "something went wrong",
      refetch,
    });

    const { result } = renderHook(() => useTrendingCampaigns(3));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe("something went wrong");
    expect(result.current.refetch).toBe(refetch);
  });
});
