import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { STELLAR_BALANCE_POLL_MS, useStellarBalance } from "@/hooks/useStellarBalance";

jest.mock("@/lib/getStellarBalance", () => ({
  getStellarBalance: jest.fn(),
  getStellarNetworkKey: jest.fn(() => "testnet"),
}));

jest.mock("@/hooks/useWindowVisibility", () => ({
  useWindowVisibility: jest.fn(() => true),
}));

import { getStellarBalance } from "@/lib/getStellarBalance";
import { useWindowVisibility } from "@/hooks/useWindowVisibility";

const mockGetStellarBalance = getStellarBalance as jest.MockedFunction<typeof getStellarBalance>;
const mockUseWindowVisibility = useWindowVisibility as jest.MockedFunction<typeof useWindowVisibility>;

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
    mockUseWindowVisibility.mockReturnValue(true);
  });

  it("uses a 10–30s balance poll interval (not sub-10s chatter)", () => {
    expect(STELLAR_BALANCE_POLL_MS).toBeGreaterThanOrEqual(10_000);
    expect(STELLAR_BALANCE_POLL_MS).toBeLessThanOrEqual(30_000);
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

  it("still resolves balance when the tab is hidden (no background interval chatter)", async () => {
    mockUseWindowVisibility.mockReturnValue(false);
    mockGetStellarBalance.mockResolvedValue(7);

    const { result } = renderHook(() => useStellarBalance("GABC123"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.balance).toBe(7));
    expect(mockGetStellarBalance).toHaveBeenCalledTimes(1);
  });
});
