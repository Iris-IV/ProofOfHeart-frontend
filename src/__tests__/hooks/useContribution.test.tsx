import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useContribution } from "@/hooks/useContribution";

jest.mock("@/lib/contractClient", () => ({
  getContribution: jest.fn(),
}));

import { getContribution } from "@/lib/contractClient";

const mockGetContribution = getContribution as jest.MockedFunction<typeof getContribution>;

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useContribution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches the contribution for a valid numeric campaign id", async () => {
    mockGetContribution.mockResolvedValue(BigInt(5_000_000));

    const { result } = renderHook(() => useContribution(1, "GUSER"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.contribution).toBe(BigInt(5_000_000));
    expect(mockGetContribution).toHaveBeenCalledWith(1, "GUSER");
  });

  it("does not fetch when campaignId is NaN (e.g. parsed from an invalid string)", async () => {
    const id = parseInt("not-a-number", 10);
    expect(Number.isNaN(id)).toBe(true);

    const { result } = renderHook(() => useContribution(id, "GUSER"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetContribution).not.toHaveBeenCalled();
    expect(result.current.contribution).toBe(BigInt(0));
  });

  it("does not fetch when userAddress is null", async () => {
    const { result } = renderHook(() => useContribution(1, null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetContribution).not.toHaveBeenCalled();
  });

  it("still fetches when campaignId is a legitimate id of 0 (regression: !!campaignId was falsy for 0)", async () => {
    mockGetContribution.mockResolvedValue(BigInt(1_000));

    const { result } = renderHook(() => useContribution(0, "GUSER"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetContribution).toHaveBeenCalledWith(0, "GUSER");
    expect(result.current.contribution).toBe(BigInt(1_000));
  });

  it("parses a string campaignId before querying", async () => {
    mockGetContribution.mockResolvedValue(BigInt(2_000));

    const { result } = renderHook(() => useContribution("42", "GUSER"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetContribution).toHaveBeenCalledWith(42, "GUSER");
  });
});
