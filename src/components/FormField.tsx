import { type InputHTMLAttributes, type ReactNode, forwardRef } from "react";

/**
 * Shared labeled-input wrapper, extracted to stop the label+input markup
 * (`block text-sm font-medium ...` + input) from being copy-pasted across
 * DonationModal, NewCauseClient, ReportModal, CommentComposer, and
 * EditCampaignMetadata (#1065). New forms should use this instead of
 * hand-rolling the label/input pair again.
 */
export interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, htmlFor, error, hint, className, ...inputProps }, ref) => {
    return (
      <div>
        <label
          htmlFor={htmlFor}
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={htmlFor}
          className={
            className ??
            "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          }
          {...inputProps}
        />
        {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    );
  },
);

FormField.displayName = "FormField";
