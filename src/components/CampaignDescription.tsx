"use client";

import { memo, ReactNode } from "react";

export const EMPTY_DESCRIPTION_FALLBACK = "No description provided by the creator.";

/**
 * True when the description would render as blank space (#645).
 *
 * Checks more than `!description`: a value made only of whitespace, or only of
 * markdown punctuation with no words (`---`, `**  **`, `>`), renders empty and
 * leaves the same awkward gap as a missing description.
 */
export function isDescriptionEmpty(description: string | null | undefined): boolean {
  if (typeof description !== "string") return true;
  return description.replace(/[\s#>*_~`\-+=|[\]()]/g, "") === "";
}

interface CampaignDescriptionProps {
  description: string | null | undefined;
  /**
   * Rendered form of the description, e.g. a `<ReactMarkdown>` element. Only
   * rendered when the description is non-empty; otherwise the fallback shows.
   * Omit it to render `description` as plain text.
   */
  children?: ReactNode;
  className?: string;
}

/**
 * Renders a campaign description, or a fallback message when the content is
 * empty or failed to load, instead of leaving a blank block (#645).
 *
 * Deliberately does not import a markdown renderer: callers pass their own via
 * `children`, so this component stays usable in both the markdown detail view
 * and the plain-text card preview.
 */
function CampaignDescription({ description, children, className }: CampaignDescriptionProps) {
  if (isDescriptionEmpty(description)) {
    return (
      <p
        data-testid="campaign-description-fallback"
        className={className ?? "text-sm italic text-zinc-500 dark:text-zinc-400"}
      >
        {EMPTY_DESCRIPTION_FALLBACK}
      </p>
    );
  }

  if (children) {
    return (
      <div
        data-testid="campaign-description"
        className={className ?? "prose prose-zinc dark:prose-invert max-w-none"}
      >
        {children}
      </div>
    );
  }

  return (
    <p
      data-testid="campaign-description"
      className={
        className ?? "text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3 leading-relaxed"
      }
    >
      {(description as string).trim()}
    </p>
  );
}

export default memo(CampaignDescription);
