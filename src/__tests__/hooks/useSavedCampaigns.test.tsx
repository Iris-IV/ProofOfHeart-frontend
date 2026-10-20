import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useSavedCampaigns, useSavedCampaignsCount } from "@/hooks/useSavedCampaigns";
import {
  batchSaveCampaigns,
  getSavedCampaigns,
  getSavedCampaignsCount,
  removeSavedCampaign,
  saveCampaign,
} from "@/lib/contractClient";

const mockUseWallet = jest.fn();
jest.mock("@/components/WalletContext", () => ({ useWallet: () => mockUseWallet() }));

const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();
jest.mock("@/components/ToastProvider", () => ({
  useToast: () => ({ showError: mockShowError, showSuccess: mockShowSuccess }),
}));

jest.mock("@/lib/contractClient", () => ({
  MAX_BOOKMARKS_PER_WALLET: 10,
  getSavedCampaigns: jest.fn(),
  getSavedCampaignsCount: jest.fn(),
  saveCampaign: jest.fn(),
  removeSavedCampaign: jest.fn(),
  batchSaveCampaigns: jest.fn(),
}));

const mockGet = getSavedCampaigns as jest.Mock;
const mockCount = getSavedCampaignsCount as jest.Mock;
const mockSave = saveCampaign as jest.Mock;
const mockRemove = removeSavedCampaign as jest.Mock;
const mockBatch = batchSaveCampaigns as jest.Mock;

const WALLET = "GTEST";
const GUEST_KEY = "poh_saved_campaigns_guest";
const LEGACY_KEY = `poh_saved_campaigns_${WALLET}`;

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useSavedCampaigns", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    mockUseWallet.mockReturnValue({ publicKey: WALLET });
    mockGet.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    mockSave.mockResolvedValue("tx");
    mockRemove.mockResolvedValue("tx");
    mockBatch.mockResolvedValue("tx");
  });

  it("reads the saved list from the contract when a wallet is connected", async () => {
    mockGet.mockResolvedValue([4, 8]);
    const { result } = renderHook(() => useSavedCampaigns(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.savedIds).toEqual([4, 8]));
    expect(mockGet).toHaveBeenCalledWith(WALLET);
    expect(result.current.isSaved(4)).toBe(true);
    expect(result.current.isSaved(5)).toBe(false);
  });

  it("saves optimistically and calls save_campaign", async () => {
    let release: (v: string) => void = () => {};
    mockSave.mockReturnValue(new Promise((resolve) => (release = resolve)));
    const { result } = renderHook(() => useSavedCampaigns(), { wrapper: wrapper() });
    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    act(() => result.current.toggleSaved(7));

    await waitFor(() => expect(result.current.isSaved(7)).toBe(true)); // before the tx confirms
    expect(mockSave).toHaveBeenCalledWith(WALLET, 7);
    await act(() => {
      release("tx");
      return Promise.resolve();
    });
  });

  it("removes a saved campaign with remove_saved_campaign", async () => {
    mockGet.mockResolvedValue([7]);
    const { result } = renderHook(() => useSavedCampaigns(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSaved(7)).toBe(true));
    mockGet.mockResolvedValue([]);

    act(() => result.current.toggleSaved(7));

    await waitFor(() => expect(result.current.isSaved(7)).toBe(false));
    expect(mockRemove).toHaveBeenCalledWith(WALLET, 7);
  });

  it("rolls back and reports BookmarkLimitReached from the contract", async () => {
    mockSave.mockRejectedValue(new Error("ContractErrors.BookmarkLimitReached"));
    const { result } = renderHook(() => useSavedCampaigns(), { wrapper: wrapper() });
    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    act(() => result.current.toggleSaved(7));

    await waitFor(() =>
      expect(mockShowError).toHaveBeenCalledWith(expect.stringContaining("full")),
    );
    await waitFor(() => expect(result.current.isSaved(7)).toBe(false));
  });

  it("reports CampaignAlreadyBookmarked and rolls back", async () => {
    mockSave.mockRejectedValue(new Error("ContractErrors.CampaignAlreadyBookmarked"));
    const { result } = renderHook(() => useSavedCampaigns(), { wrapper: wrapper() });
    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    act(() => result.current.toggleSaved(7));

    await waitFor(() =>
      expect(mockShowError).toHaveBeenCalledWith(expect.stringContaining("already")),
    );
    expect(result.current.isSaved(7)).toBe(false);
  });

  it("does not send a transaction when the list is already at the limit", async () => {
    mockGet.mockResolvedValue([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const { result } = renderHook(() => useSavedCampaigns(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.savedIds).toHaveLength(10));

    act(() => result.current.toggleSaved(11));

    expect(mockSave).not.toHaveBeenCalled();
    expect(mockShowError).toHaveBeenCalledWith(expect.stringContaining("full"));
  });

  it("falls back to localStorage while signed out", () => {
    mockUseWallet.mockReturnValue({ publicKey: null });
    const { result } = renderHook(() => useSavedCampaigns(), { wrapper: wrapper() });

    act(() => result.current.toggleSaved(7));
    expect(result.current.savedIds).toEqual([7]);
    expect(localStorage.getItem(GUEST_KEY)).toBe("[7]");
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();

    act(() => result.current.toggleSaved(7));
    expect(localStorage.getItem(GUEST_KEY)).toBeNull();
  });

  it("falls back to an empty list when localStorage throws", () => {
    mockUseWallet.mockReturnValue({ publicKey: null });
    const spy = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });

    const { result } = renderHook(() => useSavedCampaigns(), { wrapper: wrapper() });
    expect(result.current.savedIds).toEqual([]);

    spy.mockRestore();
  });

  it("syncs all local bookmarks to the wallet in a single batch transaction", async () => {
    localStorage.setItem(GUEST_KEY, JSON.stringify([1, 2]));
    localStorage.setItem(LEGACY_KEY, JSON.stringify([2, 3]));
    mockGet.mockResolvedValue([9]);
    const { result } = renderHook(() => useSavedCampaigns(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.localBookmarks).toEqual([1, 2, 3]));

    mockGet.mockResolvedValue([9, 1, 2, 3]);
    act(() => result.current.syncLocalBookmarks());

    await waitFor(() => expect(mockBatch).toHaveBeenCalledTimes(1));
    expect(mockBatch).toHaveBeenCalledWith(WALLET, [1, 2, 3]);
    await waitFor(() => expect(result.current.localBookmarks).toEqual([]));
    expect(localStorage.getItem(GUEST_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("only syncs as many local bookmarks as the wallet has room for", async () => {
    localStorage.setItem(GUEST_KEY, JSON.stringify([21, 22, 23]));
    mockGet.mockResolvedValue([1, 2, 3, 4, 5, 6, 7, 8]);
    const { result } = renderHook(() => useSavedCampaigns(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.localBookmarks).toEqual([21, 22, 23]));

    act(() => result.current.syncLocalBookmarks());

    await waitFor(() => expect(mockBatch).toHaveBeenCalledWith(WALLET, [21, 22]));
    await waitFor(() => expect(result.current.localBookmarks).toEqual([23]));
  });
});

describe("useSavedCampaignsCount", () => {
  beforeEach(() => jest.clearAllMocks());

  it("uses get_saved_campaigns_count for the navbar badge", async () => {
    mockUseWallet.mockReturnValue({ publicKey: WALLET });
    mockCount.mockResolvedValue(5);
    const { result } = renderHook(() => useSavedCampaignsCount(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current).toBe(5));
    expect(mockCount).toHaveBeenCalledWith(WALLET);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("is 0 and makes no call while signed out", () => {
    mockUseWallet.mockReturnValue({ publicKey: null });
    const { result } = renderHook(() => useSavedCampaignsCount(), { wrapper: wrapper() });

    expect(result.current).toBe(0);
    expect(mockCount).not.toHaveBeenCalled();
  });
});
