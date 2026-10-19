import { renderHook } from "@testing-library/react";
import { useContractEvents } from "../../hooks/useContractEvents";
import { eventSubscriber } from "../../lib/eventSubscriber";

// Mock the eventSubscriber
jest.mock("../../lib/eventSubscriber", () => ({
  eventSubscriber: {
    start: jest.fn(),
    stop: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  },
}));

describe("useContractEvents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("starts event subscriber on mount", () => {
    const handler = jest.fn();
    renderHook(() => useContractEvents("test_topic", handler));

    expect(eventSubscriber.start).toHaveBeenCalledTimes(1);
  });

  it("registers handler on mount", () => {
    const handler = jest.fn();
    const { unmount } = renderHook(() => useContractEvents("test_topic", handler));

    expect(eventSubscriber.on).toHaveBeenCalledTimes(1);
    expect(eventSubscriber.on).toHaveBeenCalledWith("test_topic", expect.any(Function));

    unmount();
  });

  it("unregisters handler on unmount", () => {
    const handler = jest.fn();
    const { unmount } = renderHook(() => useContractEvents("test_topic", handler));

    unmount();

    expect(eventSubscriber.off).toHaveBeenCalledTimes(1);
    expect(eventSubscriber.off).toHaveBeenCalledWith("test_topic", expect.any(Function));
  });

  it("does not re-subscribe when handler changes", () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    const { rerender } = renderHook(
      ({ handler }) => useContractEvents("test_topic", handler),
      { initialProps: { handler: handler1 } },
    );

    expect(eventSubscriber.on).toHaveBeenCalledTimes(1);

    // Rerender with new handler
    rerender({ handler: handler2 });

    // Should NOT subscribe again (stable wrapper pattern)
    expect(eventSubscriber.on).toHaveBeenCalledTimes(1);
  });

  it("re-subscribes when topic changes", () => {
    const handler = jest.fn();

    const { rerender, unmount } = renderHook(
      ({ topic }) => useContractEvents(topic, handler),
      { initialProps: { topic: "topic1" } },
    );

    expect(eventSubscriber.on).toHaveBeenCalledTimes(1);
    expect(eventSubscriber.on).toHaveBeenCalledWith("topic1", expect.any(Function));

    // Rerender with new topic
    rerender({ topic: "topic2" });

    // Should unsubscribe from old topic and subscribe to new one
    expect(eventSubscriber.off).toHaveBeenCalledTimes(1);
    expect(eventSubscriber.on).toHaveBeenCalledTimes(2);
    expect(eventSubscriber.on).toHaveBeenNthCalledWith(2, "topic2", expect.any(Function));

    unmount();
  });

  it("cleans up properly on unmount (memory leak prevention)", () => {
    const handler = jest.fn();
    const { unmount } = renderHook(() => useContractEvents("test_topic", handler));

    unmount();

    // Verify cleanup was called
    expect(eventSubscriber.off).toHaveBeenCalledTimes(1);
  });

  it("handles multiple components subscribing to same topic", () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    const { unmount: unmount1 } = renderHook(() => useContractEvents("shared_topic", handler1));
    const { unmount: unmount2 } = renderHook(() => useContractEvents("shared_topic", handler2));

    // Both should register
    expect(eventSubscriber.on).toHaveBeenCalledTimes(2);

    // Unmount first component
    unmount1();
    expect(eventSubscriber.off).toHaveBeenCalledTimes(1);

    // Unmount second component
    unmount2();
    expect(eventSubscriber.off).toHaveBeenCalledTimes(2);
  });

  it("handles multiple components subscribing to different topics", () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    const { unmount: unmount1 } = renderHook(() => useContractEvents("topic1", handler1));
    const { unmount: unmount2 } = renderHook(() => useContractEvents("topic2", handler2));

    expect(eventSubscriber.on).toHaveBeenCalledTimes(2);
    expect(eventSubscriber.on).toHaveBeenNthCalledWith(1, "topic1", expect.any(Function));
    expect(eventSubscriber.on).toHaveBeenNthCalledWith(2, "topic2", expect.any(Function));

    unmount1();
    unmount2();
  });
});
