/** Minimum vertical travel (px) before a touch counts as a swipe. */
export const SWIPE_CLOSE_THRESHOLD_PX = 50;

export interface TouchPoint {
  x: number;
  y: number;
}

/**
 * True when a touch gesture is a deliberate upward swipe. The mobile menu drops
 * down from the top of the screen, so swiping up is the natural way to dismiss
 * it. Mostly-horizontal gestures are ignored so they don't close the menu.
 */
export function isSwipeUpToClose(
  start: TouchPoint,
  end: TouchPoint,
  threshold = SWIPE_CLOSE_THRESHOLD_PX,
): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return dy <= -threshold && Math.abs(dy) > Math.abs(dx);
}
