"use client";

import { useState } from "react";
import { Info } from "lucide-react";

interface TooltipProps {
  content: string;
  children?: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export default function Tooltip({
  content,
  children,
  side = "top",
  className = "",
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  const sideClasses = {
    top: "bottom-full mb-2",
    bottom: "top-full mt-2",
    left: "right-full mr-2",
    right: "left-full ml-2",
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
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        aria-label="More information"
        aria-describedby={isOpen ? `tooltip-content` : undefined}
        className={`inline-flex items-center justify-center rounded-full p-1 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 dark:hover:bg-zinc-700 dark:hover:text-zinc-300 dark:focus:ring-offset-zinc-900 ${className}`}
      >
        {children || <Info size={16} />}
      </button>

      {isOpen && (
        <div
          id="tooltip-content"
          role="tooltip"
          className={`absolute z-50 w-48 rounded-lg bg-zinc-700 px-3 py-2 text-xs font-medium text-white shadow-lg dark:bg-zinc-200 dark:text-zinc-900 ${sideClasses[side]}`}
        >
          {content}
          <div className={`absolute ${arrowClasses[side]}`} />
        </div>
      )}
    </div>
  );
}
