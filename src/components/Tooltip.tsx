"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Info } from "lucide-react";

interface TooltipProps {
  /** Plain text, or rich content such as a short explainer (#1356). */
  content: React.ReactNode;
  /** Optional bold heading shown above the content. */
  title?: string;
  children?: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  /** Accessible name for the trigger. Defaults to a generic label. */
  label?: string;
}

export default function Tooltip({
  content,
  title,
  children,
  side = "top",
  className = "",
  label = "More information",
}: TooltipProps) {
  // Hover (mouse only) and keyboard focus are transient; a tap pins the tooltip
  // open until it is tapped again, dismissed, or Escape is pressed. Touch
  // devices never fire the hover path, so pinning is their only way in.
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Empty when focus arrived from the keyboard rather than a pointer.
  const pointerTypeRef = useRef("");
  const tooltipId = useId();

  const isOpen = isHovered || isFocused || isPinned;
  const bubbleRef = useRef<HTMLDivElement>(null);
  // Horizontal nudge that keeps a top/bottom bubble inside the viewport, e.g.
  // for a trigger at the right edge of a 320px screen (#1356).
  const [shiftX, setShiftX] = useState(0);
  const shiftRef = useRef(0);

  useLayoutEffect(() => {
    let next = 0;
    if (isOpen && (side === "top" || side === "bottom") && bubbleRef.current) {
      const margin = 8;
      const rect = bubbleRef.current.getBoundingClientRect();
      // Measure as if no shift were applied.
      const left = rect.left - shiftRef.current;
      const right = rect.right - shiftRef.current;
      const viewport = document.documentElement.clientWidth;
      if (right > viewport - margin) next = viewport - margin - right;
      else if (left < margin) next = margin - left;
    }
    shiftRef.current = next;
    setShiftX(next);
  }, [isOpen, side, content, title]);

  const close = useCallback(() => {
    setIsHovered(false);
    setIsFocused(false);
    setIsPinned(false);
  }, []);

  // WCAG 2.1 SC 1.4.13: an open tooltip must always be dismissible without
  // moving the pointer — the only exit a touch device has.
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, close]);

  const sideClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  // Invisible bridge across the gap between trigger and bubble, so moving the
  // pointer onto the tooltip doesn't dismiss it (WCAG 2.1 SC 1.4.13).
  const bridgeClasses = {
    top: "before:absolute before:left-0 before:top-full before:h-2 before:w-full before:content-['']",
    bottom:
      "before:absolute before:bottom-full before:left-0 before:h-2 before:w-full before:content-['']",
    left: "before:absolute before:left-full before:top-0 before:h-full before:w-2 before:content-['']",
    right:
      "before:absolute before:right-full before:top-0 before:h-full before:w-2 before:content-['']",
  };

  const arrowClasses = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-zinc-900/90 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent",
    bottom:
      "bottom-full left-1/2 -translate-x-1/2 border-b-zinc-900/90 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-zinc-900/90 border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent",
    right:
      "right-full top-1/2 -translate-y-1/2 border-r-zinc-900/90 border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent",
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-flex"
      onPointerEnter={(e) => {
        // Touch fires a synthetic enter right before the tap; letting it
        // through would open the tooltip and the click would close it again.
        if (e.pointerType !== "touch") setIsHovered(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "touch") setIsHovered(false);
      }}
    >
      <button
        type="button"
        onPointerDown={(e) => {
          pointerTypeRef.current = e.pointerType || "mouse";
        }}
        onPointerCancel={() => {
          pointerTypeRef.current = "";
        }}
        onClick={() => setIsPinned((pinned) => !pinned)}
        onFocus={() => {
          // Only keyboard focus opens it; a tap must not race the click toggle.
          if (!pointerTypeRef.current) setIsFocused(true);
        }}
        onBlur={() => {
          pointerTypeRef.current = "";
          setIsFocused(false);
          setIsPinned(false);
        }}
        aria-label={label}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? tooltipId : undefined}
        // `after:` expands the hit area to the 44px touch target minimum
        // without changing the icon's layout footprint.
        className={`relative inline-flex touch-manipulation items-center justify-center rounded-full p-1 text-zinc-500 transition-colors after:absolute after:left-1/2 after:top-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] hover:bg-zinc-200 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 dark:hover:bg-zinc-700 dark:hover:text-zinc-300 dark:focus:ring-offset-zinc-900 ${className}`}
      >
        {children || <Info size={16} />}
      </button>

      {isOpen && (
        // Dark glass in both themes keeps contrast on any background; the
        // gradient hairline and 120ms pop-in are the #1356 treatment.
        <div
          ref={bubbleRef}
          id={tooltipId}
          role="tooltip"
          style={shiftX ? { marginLeft: shiftX } : undefined}
          className={`ui-pop-in absolute z-50 w-max max-w-[min(16rem,calc(100vw-2rem))] rounded-xl bg-zinc-900/90 px-3 py-2 text-left text-xs font-medium leading-relaxed text-white shadow-xl shadow-black/20 ring-1 ring-white/10 backdrop-blur-xl sm:max-w-[min(18rem,calc(100vw-2rem))] ${sideClasses[side]} ${bridgeClasses[side]}`}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/80 to-transparent"
          />
          {title && <span className="mb-1 block text-[13px] font-semibold">{title}</span>}
          <span className="block font-normal text-zinc-200">{content}</span>
          {/* Counter-shift the arrow so it keeps pointing at the trigger. */}
          <div
            className={`absolute ${arrowClasses[side]}`}
            style={shiftX ? { marginLeft: -shiftX } : undefined}
          />
        </div>
      )}
    </div>
  );
}
