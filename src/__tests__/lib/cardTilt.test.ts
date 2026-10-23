import { computeTilt, tiltTransform, MAX_TILT_DEG } from "@/lib/cardTilt";

const rect = { width: 200, height: 100 };

describe("computeTilt", () => {
  it("is neutral at the centre of the card", () => {
    expect(computeTilt(100, 50, rect)).toEqual({ rotateX: 0, rotateY: 0 });
  });

  it("tilts towards the pointer at the top-right corner", () => {
    expect(computeTilt(200, 0, rect)).toEqual({ rotateX: MAX_TILT_DEG, rotateY: MAX_TILT_DEG });
  });

  it("tilts the other way at the bottom-left corner", () => {
    expect(computeTilt(0, 100, rect)).toEqual({ rotateX: -MAX_TILT_DEG, rotateY: -MAX_TILT_DEG });
  });

  it("clamps pointer positions outside the card", () => {
    expect(computeTilt(9999, -9999, rect)).toEqual({
      rotateX: MAX_TILT_DEG,
      rotateY: MAX_TILT_DEG,
    });
  });

  it("returns no tilt for a zero-sized element", () => {
    expect(computeTilt(10, 10, { width: 0, height: 0 })).toEqual({ rotateX: 0, rotateY: 0 });
  });

  it("honours a custom maximum", () => {
    expect(computeTilt(200, 50, rect, 12).rotateY).toBe(12);
  });
});

describe("tiltTransform", () => {
  it("builds a perspective transform from the tilt", () => {
    expect(tiltTransform({ rotateX: -2.5, rotateY: 4 })).toBe(
      "perspective(900px) rotateX(-2.5deg) rotateY(4deg)",
    );
  });
});
