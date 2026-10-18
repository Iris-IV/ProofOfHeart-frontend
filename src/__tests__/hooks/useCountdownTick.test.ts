import { renderHook, act } from "@testing-library/react";
import {
  subscribeToCountdownTick,
  useCountdownTick,
  getCountdownSubscriberCount,
  resetCountdownTick,
} from "@/hooks/useCountdownTick";

describe("useCountdownTick", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetCountdownTick();
  });

  afterEach(() => {
    resetCountdownTick();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("shares a single setInterval across multiple subscribers and clears it when all unmount", () => {
    const setIntervalSpy = jest.spyOn(global, "setInterval");
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");

    const cb1 = jest.fn();
    const cb2 = jest.fn();

    const { unmount: unmount1 } = renderHook(() => useCountdownTick(cb1));
    const { unmount: unmount2 } = renderHook(() => useCountdownTick(cb2));

    expect(getCountdownSubscriberCount()).toBe(2);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);

    unmount1();
    expect(getCountdownSubscriberCount()).toBe(1);
    expect(clearIntervalSpy).not.toHaveBeenCalled();

    unmount2();
    expect(getCountdownSubscriberCount()).toBe(0);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it("cancels pending requestAnimationFrame handle on unmount when useAnimationFrame is enabled", () => {
    let scheduledRafCallback: FrameRequestCallback | null = null;
    const rafSpy = jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        scheduledRafCallback = cb;
        return 42;
      });
    const cancelRafSpy = jest
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => {});

    const onTick = jest.fn();
    const { unmount } = renderHook(() =>
      useCountdownTick(onTick, { useAnimationFrame: true })
    );

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(rafSpy).toHaveBeenCalledTimes(1);
    expect(onTick).not.toHaveBeenCalled();

    // Unmount before animation frame fires — must cancel the pending rAF handle
    unmount();
    expect(cancelRafSpy).toHaveBeenCalledWith(42);
    expect(getCountdownSubscriberCount()).toBe(0);
    expect(scheduledRafCallback).not.toBeNull();
  });

  it("does not subscribe when enabled is false", () => {
    const setIntervalSpy = jest.spyOn(global, "setInterval");
    const onTick = jest.fn();

    const { unmount } = renderHook(() =>
      useCountdownTick(onTick, { enabled: false })
    );

    expect(getCountdownSubscriberCount()).toBe(0);
    expect(setIntervalSpy).not.toHaveBeenCalled();
    unmount();
  });

  it("handles idempotent unsubscribe calls and isolates subscriber errors", () => {
    const badSubscriber = jest.fn(() => {
      throw new Error("subscriber failure");
    });
    const goodSubscriber = jest.fn();

    const unsub1 = subscribeToCountdownTick(badSubscriber);
    const unsub2 = subscribeToCountdownTick(goodSubscriber);

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(badSubscriber).toHaveBeenCalledTimes(1);
    expect(goodSubscriber).toHaveBeenCalledTimes(1);

    unsub1();
    unsub1(); // second call is a no-op
    expect(getCountdownSubscriberCount()).toBe(1);

    unsub2();
    expect(getCountdownSubscriberCount()).toBe(0);
  });
});
