import { act, renderHook, waitFor } from "@testing-library/react";
import { useNotifications } from "@/hooks/useNotifications";
import type { AppNotification } from "@/lib/notifications";

jest.mock("@/lib/notifications", () => ({
  fetchNotifications: jest.fn(),
  markAllNotificationsRead: jest.fn(),
  markNotificationRead: jest.fn(),
}));

import { fetchNotifications } from "@/lib/notifications";

const mockFetchNotifications = fetchNotifications as jest.MockedFunction<typeof fetchNotifications>;

const SAMPLE: AppNotification[] = [
  {
    id: "n1",
    type: "contribution_confirmed",
    campaignId: 1,
    campaignTitle: "Campaign #1",
    message: "Contribution confirmed",
    href: "/causes/1",
    timestamp: Date.now(),
    read: false,
  },
];

describe("useNotifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("loads notifications for a connected wallet", async () => {
    mockFetchNotifications.mockResolvedValue(SAMPLE);

    const { result } = renderHook(() => useNotifications("GABC123"));

    await waitFor(() => expect(result.current.notifications).toEqual(SAMPLE));
    expect(result.current.unreadCount).toBe(1);
    expect(mockFetchNotifications).toHaveBeenCalledWith("GABC123", {
      signal: expect.any(AbortSignal),
    });
  });

  it("clears notifications when walletAddress is null", async () => {
    const { result } = renderHook(() => useNotifications(null));

    await waitFor(() => expect(result.current.notifications).toEqual([]));
    expect(mockFetchNotifications).not.toHaveBeenCalled();
  });

  it("aborts the inflight fetch on unmount so setState is not called after cleanup", async () => {
    let resolveFetch!: (value: AppNotification[]) => void;
    mockFetchNotifications.mockImplementation(
      (_wallet, options) =>
        new Promise<AppNotification[]>((resolve, reject) => {
          resolveFetch = resolve;
          options?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    const { unmount } = renderHook(() => useNotifications("GABC123"));

    await waitFor(() => expect(mockFetchNotifications).toHaveBeenCalled());

    unmount();

    // Completing after unmount must not throw (no stale setState) and must have been aborted.
    const signal = mockFetchNotifications.mock.calls[0]?.[1]?.signal;
    expect(signal?.aborted).toBe(true);

    await act(async () => {
      resolveFetch(SAMPLE);
    });
  });

  it("aborts the previous inflight fetch when the wallet address changes", async () => {
    const controllers: AbortSignal[] = [];
    mockFetchNotifications.mockImplementation((_wallet, options) => {
      if (options?.signal) controllers.push(options.signal);
      return new Promise(() => {});
    });

    const { rerender } = renderHook(
      ({ wallet }: { wallet: string | null }) => useNotifications(wallet),
      { initialProps: { wallet: "GABC123" as string | null } },
    );

    await waitFor(() => expect(controllers).toHaveLength(1));

    rerender({ wallet: "GDEF456" });

    await waitFor(() => expect(controllers).toHaveLength(2));
    expect(controllers[0]?.aborted).toBe(true);
    expect(controllers[1]?.aborted).toBe(false);
  });
});
