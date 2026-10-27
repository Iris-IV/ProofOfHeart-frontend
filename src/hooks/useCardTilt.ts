"use client";

import { useCallback, useState } from "react";
import type { PointerEvent } from "react";
import { computeTilt, tiltTransform, type Tilt } from "@/lib/cardTilt";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Pointer-driven 3D tilt for a card. Returns handlers to spread onto the card
 * and the transform to apply. Touch and reduced-motion users get no tilt.
 */
export function useCardTilt() {
  const prefersReducedMotion = useReducedMotion();
  const [tilt, setTilt] = useState<Tilt | null>(null);

  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTilt(computeTilt(event.clientX - rect.left, event.clientY - rect.top, rect));
  }, []);

  const onPointerLeave = useCallback(() => setTilt(null), []);

  const style = tilt && !prefersReducedMotion ? { transform: tiltTransform(tilt) } : undefined;

  return { style, onPointerMove, onPointerLeave };
}
