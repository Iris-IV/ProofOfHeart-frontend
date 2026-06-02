import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useStellarBalance } from "@/hooks/useStellarBalance";

jest.mock("@/lib/getStellarBalance", () => ({
  getStellarBalance: jest.fn(),
  getStellarNetworkKey: jest.fn(() => "testnet"),
}));

import { getStellarBalance } from "@/lib/getStellarBalance";

const mockGetStellarBalance = getStellarBalance as jest.MockedFunction<typeof getStellarBalance>;

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useStellarBalance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not fetch when publicKey is null", () => {
    const { result } = renderHook(() => useStellarBalance(null), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.balance).toBeNull();
    expect(mockGetStellarBalance).not.toHaveBeenCalled();
  });

  it("returns balance when fetch succeeds", async () => {
    mockGetStellarBalance.mockResolvedValue(42.5);

    const { result } = renderHook(() => useStellarBalance("GABC123"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.balance).toBe(42.5);
    expect(result.current.error).toBeNull();
    expect(mockGetStellarBalance).toHaveBeenCalledWith("GABC123");
  });

  it("exposes error when fetch fails", async () => {
    mockGetStellarBalance.mockRejectedValue(new Error("horizon unavailable"));

    const { result } = renderHook(() => useStellarBalance("GABC123"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.error?.message).toBe("horizon unavailable"), {
      timeout: 5000,
    });

    expect(result.current.balance).toBeNull();
  });

  it("dedupes concurrent requests for the same wallet via shared query cache", async () => {
    mockGetStellarBalance.mockResolvedValue(10);

    const wrapper = createWrapper();
    renderHook(() => useStellarBalance("GABC123"), { wrapper });
    renderHook(() => useStellarBalance("GABC123"), { wrapper });

    await waitFor(() => expect(mockGetStellarBalance).toHaveBeenCalledTimes(1));
  });
});
