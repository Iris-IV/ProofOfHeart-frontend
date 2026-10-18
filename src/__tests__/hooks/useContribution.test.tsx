import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useContribution } from "@/hooks/useContribution";

jest.mock("@/lib/contractClient", () => ({
  getContribution: jest.fn(),
  contribute: jest.fn(),
}));

import { contribute, getContribution } from "@/lib/contractClient";
import { Category, type Campaign } from "@/types";

const mockGetContribution = getContribution as jest.MockedFunction<typeof getContribution>;
const mockContribute = contribute as jest.MockedFunction<typeof contribute>;

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

  describe("optimistic contribute", () => {
    function makeCampaign(id: number, raised: bigint): Campaign {
      return {
        id,
        creator: "GCREATOR",
        title: `Campaign ${id}`,
        description: "Desc",
        created_at: 1,
        status: "active",
        funding_goal: BigInt(100_000_000),
        deadline: 9_999_999_999,
        amount_raised: raised,
        is_active: true,
        funds_withdrawn: false,
        is_cancelled: false,
        is_verified: true,
        category: Category.Educator,
        has_revenue_sharing: false,
        revenue_share_percentage: 0,
      };
    }

    function setup() {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      client.setQueryData(
        ["campaigns"],
        [makeCampaign(1, BigInt(1_000)), makeCampaign(2, BigInt(500))],
      );
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
      const hook = renderHook(() => useContribution(1, "GUSER"), { wrapper });
      const raisedFor = (id: number) =>
        client.getQueryData<Campaign[]>(["campaigns"])?.find((c) => c.id === id)?.amount_raised;
      return { client, hook, raisedFor };
    }

    it("shows the new totals before the transaction confirms", async () => {
      mockGetContribution.mockResolvedValue(BigInt(100));
      let confirm: (hash: string) => void = () => undefined;
      mockContribute.mockReturnValue(new Promise((resolve) => (confirm = resolve)));
      const { hook, raisedFor } = setup();
      await waitFor(() => expect(hook.result.current.contribution).toBe(BigInt(100)));

      let sent: Promise<string> | undefined;
      act(() => {
        sent = hook.result.current.contribute({ amount: BigInt(50) });
      });

      await waitFor(() => expect(hook.result.current.contribution).toBe(BigInt(150)));
      expect(hook.result.current.isContributing).toBe(true);
      expect(raisedFor(1)).toBe(BigInt(1_050));
      expect(raisedFor(2)).toBe(BigInt(500));
      expect(mockContribute).toHaveBeenCalledWith(1, "GUSER", BigInt(50), undefined);

      mockGetContribution.mockResolvedValue(BigInt(150));
      await act(async () => {
        confirm("tx-hash");
        await expect(sent).resolves.toBe("tx-hash");
      });
      await waitFor(() => expect(hook.result.current.isContributing).toBe(false));
      expect(hook.result.current.contribution).toBe(BigInt(150));
    });

    it("rolls back and exposes the contract error when the transaction fails", async () => {
      mockGetContribution.mockResolvedValue(BigInt(100));
      mockContribute.mockRejectedValue(new Error("ContractErrors.DeadlinePassed"));
      const { hook, raisedFor } = setup();
      await waitFor(() => expect(hook.result.current.contribution).toBe(BigInt(100)));

      await act(async () => {
        await expect(hook.result.current.contribute({ amount: BigInt(50) })).rejects.toThrow(
          "ContractErrors.DeadlinePassed",
        );
      });

      await waitFor(() =>
        expect(hook.result.current.contributionError).toBe("ContractErrors.DeadlinePassed"),
      );
      expect(hook.result.current.contribution).toBe(BigInt(100));
      expect(raisedFor(1)).toBe(BigInt(1_000));
    });
  });
});
