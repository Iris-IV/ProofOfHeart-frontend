"use client";

import { forwardRef, useId } from "react";
import { cn } from "./cn";

const CONTROL_BASE =
  "w-full px-3 py-2.5 text-sm rounded-control bg-white dark:bg-zinc-900 " +
  "text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 " +
  "border border-zinc-300 dark:border-zinc-600 focus-ring " +
  "transition-colors duration-(--duration-fast) disabled:opacity-60 disabled:cursor-not-allowed";

const INVALID = "border-danger dark:border-danger focus-visible:ring-danger";

interface FieldShellProps {
  label?: string;
  hint?: string;
  error?: string;
  controlId: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps a control with its label, hint and error, and wires the `aria-*`
 * relationships. Every form control in the kit renders through this, so an
 * error message is always announced instead of being a red string next to an
 * unassociated input.
 */
function FieldShell({ label, hint, error, controlId, children, className }: FieldShellProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label
          htmlFor={controlId}
          className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
        >
          {label}
        </label>
      )}
      {children}
      {hint && !error && (
        <p id={`${controlId}-hint`} className="text-xs text-zinc-500 dark:text-zinc-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${controlId}-error`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, wrapperClassName, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const controlId = id ?? generatedId;

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      controlId={controlId}
      className={wrapperClassName}
    >
      <input
        ref={ref}
        id={controlId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${controlId}-error` : hint ? `${controlId}-hint` : undefined}
        className={cn(CONTROL_BASE, error && INVALID, className)}
        {...props}
      />
    </FieldShell>
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, wrapperClassName, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const controlId = id ?? generatedId;

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      controlId={controlId}
      className={wrapperClassName}
    >
      <textarea
        ref={ref}
        id={controlId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${controlId}-error` : hint ? `${controlId}-hint` : undefined}
        className={cn(CONTROL_BASE, "leading-relaxed resize-y", error && INVALID, className)}
        {...props}
      />
    </FieldShell>
  );
});
