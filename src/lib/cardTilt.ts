/** Maximum rotation (degrees) on either axis. Kept small so the card stays readable. */
export const MAX_TILT_DEG = 6;

export interface TiltRect {
  width: number;
  height: number;
}

export interface Tilt {
  rotateX: number;
  rotateY: number;
}

/**
 * Converts a pointer position inside an element into a 3D tilt. The centre of
 * the element is neutral; the edges reach `maxDeg`. Pointer positions outside
 * the element are clamped so a fast drag never over-rotates.
 */
export function computeTilt(
  pointerX: number,
  pointerY: number,
  rect: TiltRect,
  maxDeg = MAX_TILT_DEG,
): Tilt {
  if (rect.width <= 0 || rect.height <= 0) return { rotateX: 0, rotateY: 0 };

  const nx = clamp(pointerX / rect.width, 0, 1) * 2 - 1;
  const ny = clamp(pointerY / rect.height, 0, 1) * 2 - 1;

  return {
    rotateX: round(-ny * maxDeg),
    rotateY: round(nx * maxDeg),
  };
}

/** CSS transform for a tilt, with perspective so the rotation reads as 3D. */
export function tiltTransform({ rotateX, rotateY }: Tilt): string {
  return `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  // `|| 0` turns -0 into 0 so the neutral tilt is always a plain zero.
  return Math.round(value * 100) / 100 || 0;
}
