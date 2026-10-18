import {
  MIN_TOUCH_TARGET_SIZE_PX,
  isAccessibleTouchTarget,
  getTouchTargetStyles,
} from "@/lib/preferences";

describe("touch target sizing", () => {
  it("enforces minimum 44x44px target standard (WCAG 2.1)", () => {
    expect(MIN_TOUCH_TARGET_SIZE_PX).toBe(44);
    expect(isAccessibleTouchTarget(44, 44)).toBe(true);
    expect(isAccessibleTouchTarget(48, 50)).toBe(true);
    expect(isAccessibleTouchTarget(43, 44)).toBe(false);
    expect(isAccessibleTouchTarget(44, 40)).toBe(false);
  });

  it("returns correct touch target min dimensions style", () => {
    expect(getTouchTargetStyles()).toEqual({
      minWidth: "44px",
      minHeight: "44px",
    });
  });
});
