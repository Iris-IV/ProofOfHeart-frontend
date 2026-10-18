import { act, renderHook, waitFor } from "@testing-library/react";
import { useNotifications } from "@/hooks/useNotifications";
import { fetchNotifications } from "@/lib/notifications";

jest.mock("@/lib/notifications", () => ({
  fetchNotifications: jest.fn(),
  markAllNotificationsRead: jest.fn(),
  markNotificationRead: jest.fn(),
}));

const mockFetchNotifications = fetchNotifications as jest.MockedFunction<typeof fetchNotifications>;

const WALLET = "GTEST123";

describe("useNotifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not update state after unmount once an in-flight fetch resolves", async () => {
    let resolveFetch: (value: Awaited<ReturnType<typeof fetchNotifications>>) => void;
    mockFetchNotifications.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const { unmount } = renderHook(() => useNotifications(WALLET));

    expect(mockFetchNotifications).toHaveBeenCalledTimes(1);
    const signal = mockFetchNotifications.mock.calls[0][1];
    expect(signal?.aborted).toBe(false);

    unmount();

    expect(signal?.aborted).toBe(true);

    // The in-flight promise resolves after unmount — resolving it must not
    // throw (i.e. no setState is attempted on the unmounted hook instance).
    await act(async () => {
      resolveFetch!([]);
      await Promise.resolve();
    });
  });

  it("aborts the previous in-flight request when a new refresh starts", async () => {
    mockFetchNotifications.mockResolvedValue([]);

    const { result, rerender } = renderHook(({ wallet }) => useNotifications(wallet), {
      initialProps: { wallet: WALLET },
    });

    await waitFor(() => expect(mockFetchNotifications).toHaveBeenCalledTimes(1));
    const firstSignal = mockFetchNotifications.mock.calls[0][1];

    await act(async () => {
      await result.current.refresh();
    });

    expect(firstSignal?.aborted).toBe(true);

    rerender({ wallet: WALLET });
  });
});
