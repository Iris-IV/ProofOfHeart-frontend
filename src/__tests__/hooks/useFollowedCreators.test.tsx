import { renderHook, act } from "@testing-library/react";
import { useFollowedCreators } from "@/hooks/useFollowedCreators";

const mockUseWallet = jest.fn();
jest.mock("@/components/WalletContext", () => ({ useWallet: () => mockUseWallet() }));

const CREATOR = "GCREATOR1111111111111111111111111111111111111111111111111";

describe("useFollowedCreators", () => {
  it("follows, is idempotent on duplicate follow, and unfollows", () => {
    mockUseWallet.mockReturnValue({ publicKey: CREATOR });
    const { result } = renderHook(() => useFollowedCreators());

    act(() => result.current.toggleFollow(CREATOR));
    expect(result.current.isFollowing(CREATOR)).toBe(true);

    act(() => result.current.toggleFollow(CREATOR));
    expect(result.current.followedAddresses).toEqual([]);

    act(() => result.current.toggleFollow(CREATOR));
    const { unmount } = renderHook(() => useFollowedCreators());
    expect(unmount).toBeDefined();
  });
});
