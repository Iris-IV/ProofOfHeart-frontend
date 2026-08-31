import { renderHook, act } from "@testing-library/react";
import { useCampaignEvents, type CampaignEvent } from "@/hooks/useCampaignEvents";

jest.mock("@/hooks/useWindowVisibility", () => ({
  useWindowVisibility: jest.fn(),
}));

import { useWindowVisibility } from "@/hooks/useWindowVisibility";

const mockUseWindowVisibility = useWindowVisibility as jest.MockedFunction<
  typeof useWindowVisibility
>;

interface TestEvent extends CampaignEvent {
  type: string;
}

function makeEvent(id: string): TestEvent {
  return { id, type: "test" };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockUseWindowVisibility.mockReturnValue(true);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useCampaignEvents", () => {
  it("calls fetchEvents on mount and delivers unseen events", async () => {
    const onUnseenEvents = jest.fn();
    const fetchEvents = jest.fn().mockResolvedValue({
      events: [makeEvent("1"), makeEvent("2")],
      cursor: "cur1",
    });

    renderHook(() =>
      useCampaignEvents({
        campaignId: 1,
        fetchEvents,
        onUnseenEvents,
        pollIntervalMs: 1000,
      }),
    );

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(fetchEvents).toHaveBeenCalledWith({ campaignId: 1, cursor: undefined });
    expect(onUnseenEvents).toHaveBeenCalledWith([makeEvent("1"), makeEvent("2")]);
  });

  it("deduplicates events across polls", async () => {
    const onUnseenEvents = jest.fn();
    const fetchEvents = jest
      .fn()
      .mockResolvedValueOnce({ events: [makeEvent("1"), makeEvent("2")], cursor: "c1" })
      .mockResolvedValueOnce({ events: [makeEvent("2"), makeEvent("3")], cursor: "c2" });

    renderHook(() =>
      useCampaignEvents({
        campaignId: 1,
        fetchEvents,
        onUnseenEvents,
        pollIntervalMs: 1000,
      }),
    );

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(onUnseenEvents).toHaveBeenCalledTimes(1);
    expect(onUnseenEvents).toHaveBeenCalledWith([makeEvent("1"), makeEvent("2")]);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });

    expect(onUnseenEvents).toHaveBeenCalledTimes(2);
    expect(onUnseenEvents).toHaveBeenLastCalledWith([makeEvent("3")]);
  });

  it("calls onError when fetchEvents throws", async () => {
    const onError = jest.fn();
    const fetchEvents = jest.fn().mockRejectedValue(new Error("rpc down"));

    renderHook(() =>
      useCampaignEvents({
        campaignId: 1,
        fetchEvents,
        onUnseenEvents: jest.fn(),
        pollIntervalMs: 1000,
        onError,
      }),
    );

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("does not poll when enabled is false", async () => {
    const fetchEvents = jest.fn().mockResolvedValue({ events: [], cursor: undefined });

    renderHook(() =>
      useCampaignEvents({
        campaignId: 1,
        enabled: false,
        fetchEvents,
        onUnseenEvents: jest.fn(),
        pollIntervalMs: 1000,
      }),
    );

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(fetchEvents).not.toHaveBeenCalled();
  });

  it("does not poll when window is not visible", async () => {
    mockUseWindowVisibility.mockReturnValue(false);
    const fetchEvents = jest.fn().mockResolvedValue({ events: [], cursor: undefined });

    renderHook(() =>
      useCampaignEvents({
        campaignId: 1,
        fetchEvents,
        onUnseenEvents: jest.fn(),
        pollIntervalMs: 1000,
      }),
    );

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(fetchEvents).not.toHaveBeenCalled();
  });

  it("resets state when campaignId changes", async () => {
    const onUnseenEvents = jest.fn();
    const fetchEvents = jest
      .fn()
      .mockResolvedValueOnce({ events: [makeEvent("1")], cursor: "c1" })
      .mockResolvedValueOnce({ events: [makeEvent("1")], cursor: "c2" });

    const { rerender } = renderHook(
      ({ campaignId }) =>
        useCampaignEvents({
          campaignId,
          fetchEvents,
          onUnseenEvents,
          pollIntervalMs: 1000,
        }),
      { initialProps: { campaignId: 1 } },
    );

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(onUnseenEvents).toHaveBeenCalledWith([makeEvent("1")]);
    onUnseenEvents.mockClear();

    rerender({ campaignId: 2 });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(onUnseenEvents).toHaveBeenCalledWith([makeEvent("1")]);
  });

  it("cleans up interval on unmount", async () => {
    const fetchEvents = jest.fn().mockResolvedValue({ events: [], cursor: undefined });

    const { unmount } = renderHook(() =>
      useCampaignEvents({
        campaignId: 1,
        fetchEvents,
        onUnseenEvents: jest.fn(),
        pollIntervalMs: 1000,
      }),
    );

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    unmount();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });

    expect(fetchEvents).toHaveBeenCalledTimes(1);
  });

  it("does not poll when campaignId is 0", async () => {
    const fetchEvents = jest.fn().mockResolvedValue({ events: [], cursor: undefined });

    renderHook(() =>
      useCampaignEvents({
        campaignId: 0,
        fetchEvents,
        onUnseenEvents: jest.fn(),
        pollIntervalMs: 1000,
      }),
    );

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(fetchEvents).not.toHaveBeenCalled();
  });

  it("does not call onUnseenEvents when result is null", async () => {
    const onUnseenEvents = jest.fn();
    const fetchEvents = jest.fn().mockResolvedValue(null);

    renderHook(() =>
      useCampaignEvents({
        campaignId: 1,
        fetchEvents,
        onUnseenEvents,
        pollIntervalMs: 1000,
      }),
    );

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(onUnseenEvents).not.toHaveBeenCalled();
  });

  it("does not deliver events after cancellation", async () => {
    const onUnseenEvents = jest.fn();
    const fetchEvents = jest.fn().mockResolvedValue({ events: [makeEvent("1")], cursor: "c1" });

    const { unmount } = renderHook(() =>
      useCampaignEvents({
        campaignId: 1,
        fetchEvents,
        onUnseenEvents,
        pollIntervalMs: 1000,
      }),
    );

    unmount();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(onUnseenEvents).not.toHaveBeenCalled();
  });

  it("uses cursor from previous poll", async () => {
    const fetchEvents = jest
      .fn()
      .mockResolvedValueOnce({ events: [makeEvent("1")], cursor: "cursor_a" })
      .mockResolvedValueOnce({ events: [makeEvent("2")], cursor: "cursor_b" });

    renderHook(() =>
      useCampaignEvents({
        campaignId: 1,
        fetchEvents,
        onUnseenEvents: jest.fn(),
        pollIntervalMs: 1000,
      }),
    );

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(fetchEvents).toHaveBeenCalledWith({ campaignId: 1, cursor: undefined });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });

    expect(fetchEvents).toHaveBeenCalledWith({ campaignId: 1, cursor: "cursor_a" });
  });
});
