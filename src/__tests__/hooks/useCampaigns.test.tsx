import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useCampaigns } from "@/hooks/useCampaigns";
import { Category, type Campaign } from "@/types";

jest.mock("@/lib/contractClient", () => ({
  getCampaignsChunk: jest.fn(),
}));

jest.mock("@/hooks/useWindowVisibility", () => ({
  useWindowVisibility: () => true,
}));

import { getCampaignsChunk } from "@/lib/contractClient";

const mockGetCampaignsChunk = getCampaignsChunk as jest.MockedFunction<typeof getCampaignsChunk>;

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

function chunkResult(...campaigns: Campaign[]) {
  return { campaigns, totalCount: campaigns.length };
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useCampaigns", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("transitions from loading to success with campaign list", async () => {
    mockGetCampaignsChunk.mockResolvedValue(chunkResult(makeCampaign(1), makeCampaign(2)));

    const { result } = renderHook(() => useCampaigns(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.campaigns).toEqual([]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.campaigns).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it("transitions from loading to error when getCampaignsChunk throws", async () => {
    mockGetCampaignsChunk.mockRejectedValue(new Error("network failure"));

    const { result } = renderHook(() => useCampaigns(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.campaigns).toEqual([]);
    expect(result.current.error).toBe("network failure");
  });

  it("exposes pagination controls", async () => {
    const campaigns = Array.from({ length: 25 }, (_, i) => makeCampaign(i + 1));
    mockGetCampaignsChunk.mockImplementation(async (startIndex: number) => {
      const chunk = campaigns.slice(startIndex, startIndex + 20);
      return { campaigns: chunk, totalCount: campaigns.length };
    });

    const { result } = renderHook(() => useCampaigns(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.campaigns).toHaveLength(20);
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.isAllLoaded).toBe(false);
  });

  it("refetch re-queries and updates the campaign list", async () => {
    mockGetCampaignsChunk
      .mockResolvedValueOnce(chunkResult(makeCampaign(1)))
      .mockResolvedValueOnce(chunkResult(makeCampaign(1), makeCampaign(2)));

    const { result } = renderHook(() => useCampaigns(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.campaigns).toHaveLength(1));

    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.campaigns).toHaveLength(2));
    expect(mockGetCampaignsChunk).toHaveBeenCalledTimes(2);
  });
});
