import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useRevenueSharing, computeRevenueSplits } from "@/hooks/useRevenueSharing";

jest.mock("@/lib/contractClient", () => ({
  getContribution: jest.fn(),
  getRevenuePool: jest.fn(),
  getRevenueClaimed: jest.fn(),
}));

import { getContribution, getRevenuePool, getRevenueClaimed } from "@/lib/contractClient";

const mockGetContribution = getContribution as jest.MockedFunction<typeof getContribution>;
const mockGetRevenuePool = getRevenuePool as jest.MockedFunction<typeof getRevenuePool>;
const mockGetRevenueClaimed = getRevenueClaimed as jest.MockedFunction<typeof getRevenueClaimed>;

function createWrapper() {
  const client = new QueryClient({
    // retryDelay: 0 keeps the hook's built-in retry behaviour fast in tests.
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useRevenueSharing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRevenuePool.mockResolvedValue(BigInt(0));
    mockGetContribution.mockResolvedValue(BigInt(0));
    mockGetRevenueClaimed.mockResolvedValue(BigInt(0));
  });

  it("fetches revenue sharing data for a valid numeric campaign id", async () => {
    mockGetRevenuePool.mockResolvedValue(BigInt(1_000_000));
    mockGetContribution.mockResolvedValue(BigInt(100_000));
    mockGetRevenueClaimed.mockResolvedValue(BigInt(0));

    const { result } = renderHook(() => useRevenueSharing(1, "GUSER", BigInt(500_000), true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetRevenuePool).toHaveBeenCalledWith(1);
    expect(result.current.revenuePool).toBe(BigInt(1_000_000));
    expect(result.current.contribution).toBe(BigInt(100_000));
  });

  it("does not fetch when campaignId is NaN (e.g. parsed from an invalid string)", async () => {
    const id = parseInt("not-a-number", 10);
    expect(Number.isNaN(id)).toBe(true);

    const { result } = renderHook(() => useRevenueSharing(id, "GUSER", BigInt(0), true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetRevenuePool).not.toHaveBeenCalled();
  });

  it("does not fetch when the caller-provided enabled flag is false", async () => {
    const { result } = renderHook(() => useRevenueSharing(1, "GUSER", BigInt(0), false), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetRevenuePool).not.toHaveBeenCalled();
  });

  it("still fetches when campaignId is a legitimate id of 0 (regression: !!campaignId was falsy for 0)", async () => {
    mockGetRevenuePool.mockResolvedValue(BigInt(50_000));

    const { result } = renderHook(() => useRevenueSharing(0, "GUSER", BigInt(0), true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetRevenuePool).toHaveBeenCalledWith(0);
    expect(result.current.revenuePool).toBe(BigInt(50_000));
  });

  it("parses a string campaignId before querying", async () => {
    const { result } = renderHook(() => useRevenueSharing("42", "GUSER", BigInt(0), true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetRevenuePool).toHaveBeenCalledWith(42);
  });

  it("splits the pool between creator and community using campaign bps", async () => {
    mockGetRevenuePool.mockResolvedValue(BigInt(1_000_000));
    mockGetContribution.mockResolvedValue(BigInt(100_000));
    mockGetRevenueClaimed.mockResolvedValue(BigInt(0));

    const { result } = renderHook(
      () => useRevenueSharing(1, "GUSER", BigInt(500_000), true, { creatorShareBps: 3_000 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // 30% creator / 70% community; contributor holds 100k of 500k raised → 20% of 700k.
    expect(result.current.creatorShare).toBe(BigInt(300_000));
    expect(result.current.communityShare).toBe(BigInt(700_000));
    expect(result.current.contributorShare).toBe(BigInt(140_000));
    expect(result.current.isStateConsistent).toBe(true);
  });

  it("deducts claimed revenue from the contributor share", async () => {
    mockGetRevenuePool.mockResolvedValue(BigInt(1_000_000));
    mockGetContribution.mockResolvedValue(BigInt(100_000));
    mockGetRevenueClaimed.mockResolvedValue(BigInt(50_000));

    const { result } = renderHook(() => useRevenueSharing(1, "GUSER", BigInt(500_000), true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.contributorShare).toBe(BigInt(200_000));
    expect(result.current.claimable).toBe(BigInt(150_000));
  });

  it("surfaces a localized error message when the fetch fails", async () => {
    mockGetRevenuePool.mockRejectedValue(new Error("Error(Contract, #2)"));

    const { result } = renderHook(() => useRevenueSharing(1, "GUSER", BigInt(0), true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.error).toBe("ContractErrors.CampaignNotFound");
    expect(result.current.revenuePool).toBe(BigInt(0));
  });
});

describe("computeRevenueSplits", () => {
  const base = {
    pool: BigInt(1_000_000),
    amountRaised: BigInt(500_000),
    contribution: BigInt(100_000),
    claimed: BigInt(0),
  };

  it("gives the whole pool to the community when no creator bps are provided", () => {
    const splits = computeRevenueSplits(base);

    expect(splits.creatorShare).toBe(BigInt(0));
    expect(splits.communityShare).toBe(BigInt(1_000_000));
    expect(splits.contributorShare).toBe(BigInt(200_000));
    expect(splits.claimable).toBe(BigInt(200_000));
    expect(splits.isConsistent).toBe(true);
  });

  it("uses integer math so shares always sum back to the pool", () => {
    const splits = computeRevenueSplits({ ...base, creatorShareBps: 3_333 });

    expect(splits.creatorShare + splits.communityShare).toBe(base.pool);
    expect(splits.creatorShare).toBe((base.pool * 3_333n) / 10_000n);
  });

  it("clamps out-of-range creator bps into 0..10000", () => {
    expect(computeRevenueSplits({ ...base, creatorShareBps: -500 }).creatorShare).toBe(BigInt(0));
    expect(computeRevenueSplits({ ...base, creatorShareBps: 99_999 }).creatorShare).toBe(base.pool);
    expect(computeRevenueSplits({ ...base, creatorShareBps: Number.NaN }).creatorShare).toBe(
      BigInt(0),
    );
  });

  it("returns a zero contributor share when nothing has been raised", () => {
    const splits = computeRevenueSplits({ ...base, amountRaised: BigInt(0) });

    expect(splits.contributorShare).toBe(BigInt(0));
    expect(splits.claimable).toBe(BigInt(0));
    expect(splits.isConsistent).toBe(true);
  });

  it("never reports a negative claimable amount", () => {
    const splits = computeRevenueSplits({ ...base, claimed: BigInt(5_000_000) });

    expect(splits.claimable).toBe(BigInt(0));
  });

  it("flags inconsistent state when the contribution exceeds the total raised", () => {
    const splits = computeRevenueSplits({ ...base, contribution: BigInt(900_000) });

    expect(splits.isConsistent).toBe(false);
  });
});
