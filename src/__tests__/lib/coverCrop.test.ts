import { centerCropRect, COVER_ASPECT } from "@/lib/coverCrop";

describe("centerCropRect", () => {
  it("returns the full image when it already matches 16:9", () => {
    expect(centerCropRect(1600, 900)).toEqual({ sx: 0, sy: 0, sw: 1600, sh: 900 });
  });

  it("crops the sides off a wide image", () => {
    // 2000x900 → 1600x900, centred horizontally.
    expect(centerCropRect(2000, 900)).toEqual({ sx: 200, sy: 0, sw: 1600, sh: 900 });
  });

  it("crops the top and bottom off a tall image", () => {
    // 1600x1600 → 1600x900, centred vertically.
    expect(centerCropRect(1600, 1600)).toEqual({ sx: 0, sy: 350, sw: 1600, sh: 900 });
  });

  it("returns an empty rect for a zero-sized image", () => {
    expect(centerCropRect(0, 0)).toEqual({ sx: 0, sy: 0, sw: 0, sh: 0 });
  });

  it("uses COVER_ASPECT by default", () => {
    expect(COVER_ASPECT).toBeCloseTo(16 / 9);
  });

  it("honours a custom aspect", () => {
    expect(centerCropRect(1000, 1000, 1)).toEqual({ sx: 0, sy: 0, sw: 1000, sh: 1000 });
  });
});
