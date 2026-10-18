"use client";

import { cn } from "./cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `md` is the standard panel padding; `none` lets the caller own it. */
  padding?: "none" | "sm" | "md" | "lg";
  /** Adds a hover lift. Use only when the whole card is a link or button. */
  interactive?: boolean;
  as?: "div" | "section" | "article" | "aside";
}

const PADDING = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
} as const;

/**
 * The standard surface: white on light, zinc-800 on dark, one border, one
 * radius. Replaces the hand-repeated
 * `bg-white dark:bg-zinc-800 rounded-xl shadow-sm border …` string that had
 * drifted across the campaign, dashboard and admin screens.
 */
export default function Card({
  padding = "md",
  interactive = false,
  as: Tag = "div",
  className,
  children,
  ...props
}: CardProps) {
  return (
    <Tag
      className={cn(
        "bg-white dark:bg-zinc-800 rounded-surface border border-zinc-200 dark:border-zinc-700 shadow-sm",
        interactive &&
          "transition-shadow duration-(--duration-base) hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-600",
        PADDING[padding],
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-between gap-card-gap mb-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-heading font-heading text-zinc-900 dark:text-zinc-50", className)}
      {...props}
    >
      {children}
    </h2>
  );
}
