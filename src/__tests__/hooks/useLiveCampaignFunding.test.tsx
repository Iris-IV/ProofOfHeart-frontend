import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useLiveCampaignFunding } from "@/hooks/useLiveCampaignFunding";
import { Category, type Campaign } from "@/types";

const mockUseCampaignContributionEvents = jest.fn();

jest.mock("@/hooks/useCampaignContributionEvents", () => ({
  useCampaignContributionEvents: (options: unknown) => mockUseCampaignContributionEvents(options),
}));

jest.mock("@/hooks/useCampaign", () => ({
  useCampaign: jest.fn(),
}));

import { useCampaign } from "@/hooks/useCampaign";

const mockUseCampaign = useCampaign as jest.MockedFunction<typeof useCampaign>;

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 1,
    creator: "GCREATOR1111111111111111111111111111111111111111111111111",
    title: "Test",
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

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useLiveCampaignFunding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCampaignContributionEvents.mockImplementation(({ onContributions }) => {
      (globalThis as { __triggerContribution?: (delta: bigint) => void }).__triggerContribution =
        (delta: bigint) => onContributions?.(delta, 1);
    });
    mockUseCampaign.mockReturnValue({
      campaign: makeCampaign(),
      isLoading: false,
      error: null,
      notFound: false,
      refetch: jest.fn(),
    });
  });

  it("increments amount raised when contribution events arrive", () => {
    const { result } = renderHook(() => useLiveCampaignFunding(1), { wrapper });

    expect(result.current.amountRaised).toBe(BigInt(10_000_000));

    act(() => {
      (globalThis as { __triggerContribution?: (delta: bigint) => void }).__triggerContribution?.(
        BigInt(5_000_000),
      );
    });

    expect(result.current.amountRaised).toBe(BigInt(15_000_000));
    expect(result.current.campaign?.amount_raised).toBe(BigInt(15_000_000));
  });

  it("resets to chain value when campaign reconciles from get_campaign", () => {
    const { result, rerender } = renderHook(() => useLiveCampaignFunding(1), { wrapper });

    act(() => {
      (globalThis as { __triggerContribution?: (delta: bigint) => void }).__triggerContribution?.(
        BigInt(5_000_000),
      );
    });
    expect(result.current.amountRaised).toBe(BigInt(15_000_000));

    mockUseCampaign.mockReturnValue({
      campaign: makeCampaign({ amount_raised: BigInt(12_000_000) }),
      isLoading: false,
      error: null,
      notFound: false,
      refetch: jest.fn(),
    });
    rerender();

    expect(result.current.amountRaised).toBe(BigInt(12_000_000));
  });
});
