import { isSwipeUpToClose, SWIPE_CLOSE_THRESHOLD_PX } from "@/lib/mobileMenuGesture";

describe("isSwipeUpToClose", () => {
  const start = { x: 100, y: 300 };

  it("closes on a deliberate upward swipe", () => {
    expect(isSwipeUpToClose(start, { x: 100, y: 200 })).toBe(true);
  });

  it("ignores a swipe shorter than the threshold", () => {
    expect(isSwipeUpToClose(start, { x: 100, y: 300 - SWIPE_CLOSE_THRESHOLD_PX + 1 })).toBe(false);
  });

  it("accepts a swipe exactly at the threshold", () => {
    expect(isSwipeUpToClose(start, { x: 100, y: 300 - SWIPE_CLOSE_THRESHOLD_PX })).toBe(true);
  });

  it("ignores downward swipes", () => {
    expect(isSwipeUpToClose(start, { x: 100, y: 400 })).toBe(false);
  });

  it("ignores mostly-horizontal gestures", () => {
    expect(isSwipeUpToClose(start, { x: 20, y: 240 })).toBe(false);
  });

  it("honours a custom threshold", () => {
    expect(isSwipeUpToClose(start, { x: 100, y: 290 }, 5)).toBe(true);
  });
});
