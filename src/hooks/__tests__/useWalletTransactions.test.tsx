import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWalletTransactions } from "../useWalletTransactions";
import * as transactionLog from "@/lib/transactionLog";

jest.mock("@/lib/transactionLog", () => ({
  getWalletTransactions: jest.fn(),
}));

describe("useWalletTransactions", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    jest.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("returns empty array when walletAddress is null", () => {
    const { result } = renderHook(() => useWalletTransactions(null), { wrapper });

    expect(result.current.transactions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(transactionLog.getWalletTransactions).not.toHaveBeenCalled();
  });

  it("fetches wallet transactions and deduplicates requests across components", async () => {
    const mockTxEntries: transactionLog.WalletTransactionLogEntry[] = [
      {
        walletAddress: "GABC123",
        campaignId: 1,
        action: "contribute",
        txHash: "hash123",
        timestamp: 1000,
      },
    ];

    (transactionLog.getWalletTransactions as jest.Mock).mockReturnValue(mockTxEntries);

    const { result: result1 } = renderHook(() => useWalletTransactions("GABC123"), { wrapper });
    const { result: result2 } = renderHook(() => useWalletTransactions("GABC123"), { wrapper });

    await waitFor(() => {
      expect(result1.current.isLoading).toBe(false);
      expect(result2.current.isLoading).toBe(false);
    });

    expect(result1.current.transactions).toEqual(mockTxEntries);
    expect(result2.current.transactions).toEqual(mockTxEntries);
    expect(transactionLog.getWalletTransactions).toHaveBeenCalledTimes(1);
  });
});
