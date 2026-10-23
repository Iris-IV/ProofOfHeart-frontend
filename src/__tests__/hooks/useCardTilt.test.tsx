import { act, renderHook } from "@testing-library/react";
import { useCardTilt } from "@/hooks/useCardTilt";

let reducedMotion = false;
jest.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => reducedMotion,
}));

function pointerEvent(pointerType: string, clientX: number, clientY: number) {
  return {
    pointerType,
    clientX,
    clientY,
    currentTarget: {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }),
    },
  } as unknown as React.PointerEvent<HTMLElement>;
}

beforeEach(() => {
  reducedMotion = false;
});

describe("useCardTilt", () => {
  it("has no transform until the mouse moves over the card", () => {
    const { result } = renderHook(() => useCardTilt());
    expect(result.current.style).toBeUndefined();
  });

  it("applies a tilt on mouse move", () => {
    const { result } = renderHook(() => useCardTilt());
    act(() => result.current.onPointerMove(pointerEvent("mouse", 200, 0)));
    expect(result.current.style?.transform).toBe("perspective(900px) rotateX(6deg) rotateY(6deg)");
  });

  it("resets the tilt when the pointer leaves", () => {
    const { result } = renderHook(() => useCardTilt());
    act(() => result.current.onPointerMove(pointerEvent("mouse", 200, 0)));
    act(() => result.current.onPointerLeave());
    expect(result.current.style).toBeUndefined();
  });

  it("ignores touch input so scrolling is never affected", () => {
    const { result } = renderHook(() => useCardTilt());
    act(() => result.current.onPointerMove(pointerEvent("touch", 200, 0)));
    expect(result.current.style).toBeUndefined();
  });

  it("never tilts when the user prefers reduced motion", () => {
    reducedMotion = true;
    const { result } = renderHook(() => useCardTilt());
    act(() => result.current.onPointerMove(pointerEvent("mouse", 200, 0)));
    expect(result.current.style).toBeUndefined();
  });
});
