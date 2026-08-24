import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { usePersonalCap } from "@/hooks/usePersonalCap";

jest.mock("@/lib/contractClient", () => ({
  getPersonalCap: jest.fn(),
}));

import { getPersonalCap } from "@/lib/contractClient";

const mockGetPersonalCap = getPersonalCap as jest.MockedFunction<typeof getPersonalCap>;

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const WALLET = "GABC123456789012345678901234567890123456789012345678901234567890";

describe("usePersonalCap", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches the personal cap for a connected wallet", async () => {
    mockGetPersonalCap.mockResolvedValue(BigInt(5_000_000_000));

    const { result } = renderHook(() => usePersonalCap(1, WALLET), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetPersonalCap).toHaveBeenCalledWith(1, WALLET);
    expect(result.current.personalCap).toBe(BigInt(5_000_000_000));
  });

  it("fetches for a legitimate campaign id of 0", async () => {
    mockGetPersonalCap.mockResolvedValue(BigInt(2_000_000_000));

    const { result } = renderHook(() => usePersonalCap(0, WALLET), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetPersonalCap).toHaveBeenCalledWith(0, WALLET);
    expect(result.current.personalCap).toBe(BigInt(2_000_000_000));
  });

  it("parses string campaign ids before fetching", async () => {
    mockGetPersonalCap.mockResolvedValue(BigInt(3_000_000_000));

    const { result } = renderHook(() => usePersonalCap("7", WALLET), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetPersonalCap).toHaveBeenCalledWith(7, WALLET);
    expect(result.current.personalCap).toBe(BigInt(3_000_000_000));
  });

  it("does not fetch when no wallet is connected", async () => {
    const { result } = renderHook(() => usePersonalCap(1, null), {
      wrapper: createWrapper(),
    });

    expect(result.current.personalCap).toBe(BigInt(0));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockGetPersonalCap).not.toHaveBeenCalled();
  });

  it("does not fetch when the campaign id cannot be parsed as a number", async () => {
    const { result } = renderHook(() => usePersonalCap("not-a-number", WALLET), {
      wrapper: createWrapper(),
    });

    expect(result.current.personalCap).toBe(BigInt(0));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockGetPersonalCap).not.toHaveBeenCalled();
  });
});
