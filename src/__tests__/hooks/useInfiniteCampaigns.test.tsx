import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useInfiniteCampaigns } from "@/hooks/useInfiniteCampaigns";
import { Category, type Campaign } from "@/types";

jest.mock("@/lib/contractClient", () => ({
  DEFAULT_CAMPAIGNS_PAGE_SIZE: 12,
  listCampaigns: jest.fn(),
}));

import { listCampaigns } from "@/lib/contractClient";

const mockListCampaigns = listCampaigns as jest.MockedFunction<typeof listCampaigns>;

function makeCampaign(id: number): Campaign {
  return {
    id,
    creator: "GCREATOR1111111111111111111111111111111111111111111111111",
    title: `Campaign ${id}`,
    description: "Desc",
    created_at: 1,
    status: "active",
    funding_goal: BigInt(100_000_000),
    deadline: 9_999_999_999,
    amount_raised: BigInt(10_000_000),
    is_active: true,
    funds_withdrawn: false,
    is_cancelled: false,
    is_verified: true,
    category: Category.Educator,
    has_revenue_sharing: false,
    revenue_share_percentage: 0,
  };
}

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useInfiniteCampaigns", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads the first page and reports whether more pages exist", async () => {
    mockListCampaigns.mockResolvedValue({
      campaigns: [makeCampaign(1), makeCampaign(2)],
      nextCursor: 3,
    });

    const { result } = renderHook(() => useInfiniteCampaigns(2), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.campaigns).toHaveLength(2);
    expect(result.current.hasNextPage).toBe(true);
    expect(mockListCampaigns).toHaveBeenCalledWith({ cursor: 1, limit: 2 });
  });

  it("flattens pages and stops once nextCursor is null", async () => {
    mockListCampaigns
      .mockResolvedValueOnce({ campaigns: [makeCampaign(1), makeCampaign(2)], nextCursor: 3 })
      .mockResolvedValueOnce({ campaigns: [makeCampaign(3)], nextCursor: null });

    const { result } = renderHook(() => useInfiniteCampaigns(2), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.campaigns).toHaveLength(2));

    await act(async () => {
      result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.campaigns).toHaveLength(3));
    expect(result.current.campaigns.map((c) => c.id)).toEqual([1, 2, 3]);
    expect(result.current.hasNextPage).toBe(false);
  });

  it("surfaces a fetch error", async () => {
    mockListCampaigns.mockRejectedValue(new Error("rpc down"));

    const { result } = renderHook(() => useInfiniteCampaigns(2), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("rpc down");
    expect(result.current.campaigns).toEqual([]);
  });
});
