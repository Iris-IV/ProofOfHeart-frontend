"use client";

import { useRef, useState } from "react";
import { Bold, Italic, Link2, List, Heading2 } from "lucide-react";
import SafeMarkdown from "@/components/SafeMarkdown";
import { useToast } from "@/components/ToastProvider";
import { Button } from "@/components/ui";

interface UpdateComposerProps {
  campaignId: number;
  creatorAddress: string;
  onSubmit: (content: string, notify: boolean) => Promise<void>;
  isSubmitting: boolean;
}

const MIN_CONTENT_LENGTH = 10;
const MAX_CONTENT_LENGTH = 2000;

type ComposerMode = "write" | "preview";

/**
 * Markdown snippets the toolbar inserts. `wrap` surrounds the selection,
 * `prefix` starts the line — enough to cover the formatting creators reach for
 * without pulling in a WYSIWYG editor and its sanitisation surface.
 */
const TOOLBAR = [
  { id: "bold", label: "Bold", icon: Bold, wrap: "**", placeholder: "bold text" },
  { id: "italic", label: "Italic", icon: Italic, wrap: "_", placeholder: "italic text" },
  { id: "heading", label: "Heading", icon: Heading2, prefix: "## ", placeholder: "Heading" },
  { id: "list", label: "Bullet list", icon: List, prefix: "- ", placeholder: "List item" },
  { id: "link", label: "Link", icon: Link2, link: true, placeholder: "link text" },
] as const;

/**
 * Composer for campaign creators to post rich updates.
 *
 * Content is markdown: it is stored as written and rendered through
 * `SafeMarkdown`, so the preview here is the same renderer contributors see.
 * Only visible to the campaign creator.
 */
export default function UpdateComposer({
  campaignId,
  creatorAddress,
  onSubmit,
  isSubmitting,
}: UpdateComposerProps) {
  const [content, setContent] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [notify, setNotify] = useState(true);
  const [mode, setMode] = useState<ComposerMode>("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { showError, showSuccess } = useToast();

  const applyFormat = (item: (typeof TOOLBAR)[number]) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end) || item.placeholder;

    let inserted: string;
    if ("link" in item) {
      inserted = `[${selected}](https://)`;
    } else if ("wrap" in item) {
      inserted = `${item.wrap}${selected}${item.wrap}`;
    } else {
      // Line prefix: start on a fresh line unless we already are on one.
      const needsNewline = start > 0 && content[start - 1] !== "\n";
      inserted = `${needsNewline ? "\n" : ""}${item.prefix}${selected}`;
    }

    const next = content.slice(0, start) + inserted + content.slice(end);
    setContent(next);

    // Restore focus and put the caret after the inserted snippet.
    requestAnimationFrame(() => {
      textarea.focus();
      const caret = start + inserted.length;
      textarea.setSelectionRange(caret, caret);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedContent = content.trim();
    if (trimmedContent.length < MIN_CONTENT_LENGTH) {
      showError(`Update must be at least ${MIN_CONTENT_LENGTH} characters.`);
      return;
    }

    try {
      await onSubmit(trimmedContent, notify);
      setContent("");
      setIsExpanded(false);
      setMode("write");
      showSuccess("Update posted successfully!");
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Failed to post update. Please try again.",
      );
    }
  };

  const handleCancel = () => {
    setContent("");
    setIsExpanded(false);
    setMode("write");
  };

  const characterCount = content.length;
  const isOverLimit = characterCount > MAX_CONTENT_LENGTH;
  const isUnderMinLength = characterCount > 0 && characterCount < MIN_CONTENT_LENGTH;
  const canSubmit = !isSubmitting && !isOverLimit && characterCount >= MIN_CONTENT_LENGTH;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6 shadow-sm ring-1 ring-zinc-900/5 transition-all duration-300"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-linear-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
            {creatorAddress.slice(1, 3).toUpperCase()}
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Post an Update</h3>
        </div>
        {!isExpanded && (
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md">
            Visible to all contributors
          </span>
        )}
      </div>

      {!isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="w-full py-4 px-6 bg-linear-to-r from-purple-600/10 to-blue-600/10 hover:from-purple-600/20 hover:to-blue-600/20 text-purple-700 dark:text-purple-300 font-bold rounded-2xl border-2 border-dashed border-purple-200 dark:border-purple-800 transition-all duration-300 group"
        >
          <span className="group-hover:scale-110 inline-block transition-transform duration-200">
            ✏️
          </span>{" "}
          Write an update to your supporters...
        </button>
      ) : (
        <div className="space-y-5">
          {/* Write / Preview switch */}
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-700 pb-2">
            <div className="flex gap-1">
              {(["write", "preview"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    mode === m
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  {m === "write" ? "Write" : "Preview"}
                </button>
              ))}
            </div>

            {mode === "write" && (
              <div className="flex items-center gap-0.5">
                {TOOLBAR.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => applyFormat(item)}
                      title={item.label}
                      aria-label={item.label}
                      className="p-1.5 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                    >
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {mode === "write" ? (
            <div className="relative">
              <label htmlFor={`update-content-${campaignId}`} className="sr-only">
                Update content
              </label>
              <textarea
                ref={textareaRef}
                id={`update-content-${campaignId}`}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Share progress, milestones, or news… Markdown is supported."
                rows={5}
                aria-invalid={isOverLimit}
                aria-describedby={`update-content-count-${campaignId}`}
                className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 dark:focus:ring-purple-400/50 focus:border-purple-500/50 transition-all text-sm leading-relaxed"
                autoFocus
              />
              <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                Supports markdown: **bold**, _italic_, ## headings, - lists and [links](url).
              </p>
            </div>
          ) : (
            <div
              className="min-h-[140px] px-5 py-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl"
              data-testid="update-preview"
            >
              {content.trim() ? (
                <SafeMarkdown className="prose prose-sm prose-zinc dark:prose-invert max-w-none break-words">
                  {content}
                </SafeMarkdown>
              ) : (
                <p className="text-sm text-zinc-400 dark:text-zinc-500">
                  Nothing to preview yet — switch to Write and start typing.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Notify toggle */}
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  checked={notify}
                  onChange={(e) => setNotify(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 transition-colors"></div>
                <span className="ml-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                  Email contributors
                </span>
              </label>
            </div>

            {/* Character count */}
            <div className="flex items-center gap-2">
              <span
                id={`update-content-count-${campaignId}`}
                className={`text-[10px] font-mono tracking-tight ${
                  isOverLimit
                    ? "text-red-500"
                    : isUnderMinLength
                      ? "text-amber-500"
                      : "text-zinc-500"
                }`}
              >
                {characterCount} / {MAX_CONTENT_LENGTH}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              disabled={!canSubmit}
              isLoading={isSubmitting}
              loadingLabel="Posting..."
              fullWidth
              className="flex-1 bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
            >
              Post Update
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
