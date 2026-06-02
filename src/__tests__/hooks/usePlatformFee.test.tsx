import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { usePlatformFee, DEFAULT_PLATFORM_FEE_BPS } from "@/hooks/usePlatformFee";

jest.mock("@/lib/contractClient", () => ({
  getPlatformFee: jest.fn(),
}));

import { getPlatformFee } from "@/lib/contractClient";

const mockGetPlatformFee = getPlatformFee as jest.MockedFunction<typeof getPlatformFee>;

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("usePlatformFee", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns on-chain fee when getPlatformFee succeeds", async () => {
    mockGetPlatformFee.mockResolvedValue(250);

    const { result } = renderHook(() => usePlatformFee(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.platformFeeBps).toBe(250);
    expect(result.current.isFallback).toBe(false);
  });

  it("falls back to 300 bps when getPlatformFee throws", async () => {
    mockGetPlatformFee.mockRejectedValue(new Error("getter unavailable"));

    const { result } = renderHook(() => usePlatformFee(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isFallback).toBe(true));

    expect(result.current.platformFeeBps).toBe(DEFAULT_PLATFORM_FEE_BPS);
  });

  it("marks isFallback true while data is still undefined after error", async () => {
    mockGetPlatformFee.mockRejectedValue(new Error("rpc down"));

    const { result } = renderHook(() => usePlatformFee(), { wrapper: createWrapper() });

    expect(result.current.platformFeeBps).toBe(DEFAULT_PLATFORM_FEE_BPS);

    await waitFor(() => expect(result.current.isFallback).toBe(true));
  });

  it("exposes isLoading while the platform fee query is in flight", () => {
    mockGetPlatformFee.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => usePlatformFee(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.platformFeeBps).toBe(DEFAULT_PLATFORM_FEE_BPS);
  });

  it("supports fee and net previews from platformFeeBps", async () => {
    mockGetPlatformFee.mockResolvedValue(300);

    const { result } = renderHook(() => usePlatformFee(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const totalRaised = 100;
    const feeAmount = totalRaised * (result.current.platformFeeBps / 10_000);
    const creatorNet = totalRaised - feeAmount;

    expect(feeAmount).toBeCloseTo(3);
    expect(creatorNet).toBeCloseTo(97);
  });
});
