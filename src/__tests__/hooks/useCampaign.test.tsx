import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useCampaign } from "@/hooks/useCampaign";
import { Category, type Campaign } from "@/types";

jest.mock("@/lib/contractClient", () => ({
  getCampaign: jest.fn(),
}));

jest.mock("@/hooks/useWindowVisibility", () => ({
  useWindowVisibility: () => true,
}));

import { getCampaign } from "@/lib/contractClient";

const mockGetCampaign = getCampaign as jest.MockedFunction<typeof getCampaign>;

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 1,
    creator: "GCREATOR1111111111111111111111111111111111111111111111111",
    title: "Test Campaign",
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
    ...overrides,
  };
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useCampaign", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("transitions from loading to success with campaign data", async () => {
    mockGetCampaign.mockResolvedValue(makeCampaign());

    const { result } = renderHook(() => useCampaign(1), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.campaign).toBeNull();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.campaign?.title).toBe("Test Campaign");
    expect(result.current.error).toBeNull();
    expect(result.current.notFound).toBe(false);
  });

  it("transitions from loading to error when getCampaign throws", async () => {
    mockGetCampaign.mockRejectedValue(new Error("rpc unavailable"));

    const { result } = renderHook(() => useCampaign(1), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.campaign).toBeNull();
    expect(result.current.error).toBe("rpc unavailable");
    expect(result.current.notFound).toBe(false);
  });
});
