"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";

interface TooltipProps {
  content: string;
  children?: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  /** Accessible name for the trigger. Defaults to a generic label. */
  label?: string;
}

export default function Tooltip({
  content,
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
    top: "top-full left-1/2 -translate-x-1/2 border-t-zinc-700 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent dark:border-t-zinc-200",
    bottom:
      "bottom-full left-1/2 -translate-x-1/2 border-b-zinc-700 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent dark:border-b-zinc-200",
    left: "left-full top-1/2 -translate-y-1/2 border-l-zinc-700 border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent dark:border-l-zinc-200",
    right:
      "right-full top-1/2 -translate-y-1/2 border-r-zinc-700 border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent dark:border-r-zinc-200",
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
        <div
          id={tooltipId}
          role="tooltip"
          className={`absolute z-50 w-max max-w-[min(12rem,calc(100vw-2rem))] rounded-lg bg-zinc-700 px-3 py-2 text-xs font-medium text-white shadow-lg dark:bg-zinc-200 dark:text-zinc-900 ${sideClasses[side]} ${bridgeClasses[side]}`}
        >
          {content}
          <div className={`absolute ${arrowClasses[side]}`} />
        </div>
      )}
    </div>
  );
}
