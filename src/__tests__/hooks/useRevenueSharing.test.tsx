import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useRevenueSharing } from "@/hooks/useRevenueSharing";

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
    defaultOptions: { queries: { retry: false } },
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
});
