"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong shadow-sm",
  secondary:
    "border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800",
  ghost: "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800",
  danger: "bg-danger text-white hover:bg-danger-strong shadow-sm",
  success: "bg-success text-white hover:bg-success-strong shadow-sm",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2.5 text-sm gap-2",
  lg: "px-6 py-3 text-base gap-2",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders a spinner, disables the button, and marks it `aria-busy`. */
  isLoading?: boolean;
  /** Replaces the label while loading. Falls back to the normal children. */
  loadingLabel?: string;
  fullWidth?: boolean;
}

/**
 * The one button. Every variant is a semantic intent, not a colour, so a token
 * change in `globals.css` restyles the whole app.
 *
 * A loading button stays mounted and keeps its width — the label swaps rather
 * than the node being replaced, so layout does not jump mid-transaction.
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    isLoading = false,
    loadingLabel,
    fullWidth = false,
    disabled,
    className,
    children,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-control font-semibold tap-target focus-ring",
        "transition-colors duration-(--duration-fast)",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none",
        "active:scale-[0.98] motion-reduce:active:scale-100",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {isLoading ? (loadingLabel ?? children) : children}
    </button>
  );
});

export default Button;
