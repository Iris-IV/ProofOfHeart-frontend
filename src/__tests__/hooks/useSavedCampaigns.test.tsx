import { act, renderHook } from "@testing-library/react";
import { useSavedCampaigns } from "@/hooks/useSavedCampaigns";

const mockUseWallet = jest.fn();
jest.mock("@/components/WalletContext", () => ({ useWallet: () => mockUseWallet() }));

const KEY = "poh_saved_campaigns_GTEST";

describe("useSavedCampaigns", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    mockUseWallet.mockReturnValue({ publicKey: "GTEST" });
  });

  it("saves, lists and unsaves a campaign id", () => {
    const { result } = renderHook(() => useSavedCampaigns());

    act(() => result.current.toggleSaved(7));
    expect(result.current.isSaved(7)).toBe(true);
    expect(result.current.savedIds).toEqual([7]);
    expect(localStorage.getItem(KEY)).toBe("[7]");

    act(() => result.current.toggleSaved(7));
    expect(result.current.isSaved(7)).toBe(false);
    expect(localStorage.getItem(KEY)).toBe("[]");
  });

  it("falls back to an empty list when localStorage throws", () => {
    const spy = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });

    const { result } = renderHook(() => useSavedCampaigns());
    expect(result.current.savedIds).toEqual([]);

    spy.mockRestore();
  });
});
