"use client";

import { useRef, useState } from "react";
import { Bold, Heading2, Italic, Link2, List, Video } from "lucide-react";
import SafeMarkdown from "@/components/SafeMarkdown";
import { useToast } from "@/components/ToastProvider";
import { Button } from "@/components/ui";
import { getYoutubeEmbedUrl, isDirectVideoUrl, normalizeVideoUrl } from "@/lib/videoEmbeds";

interface UpdateComposerProps {
  campaignId: number;
  creatorAddress: string;
  onSubmit: (content: string, notify: boolean, mediaUrl?: string) => Promise<void>;
  isSubmitting: boolean;
}

const MIN_CONTENT_LENGTH = 10;
const MAX_CONTENT_LENGTH = 2000;

type ComposerMode = "write" | "preview";

/**
 * Markdown snippets the toolbar inserts. `wrap` surrounds the selection,
 * `prefix` starts the line - enough to cover the formatting creators reach for
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
  const [videoUrl, setVideoUrl] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [notify, setNotify] = useState(true);
  const [mode, setMode] = useState<ComposerMode>("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { showError, showSuccess } = useToast();

  const normalizedVideoUrl = normalizeVideoUrl(videoUrl);
  const youtubeEmbedUrl = normalizedVideoUrl ? getYoutubeEmbedUrl(normalizedVideoUrl) : null;

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
      const needsNewline = start > 0 && content[start - 1] !== "\n";
      inserted = `${needsNewline ? "\n" : ""}${item.prefix}${selected}`;
    }

    const next = content.slice(0, start) + inserted + content.slice(end);
    setContent(next);

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

    if (videoUrl.trim() && !normalizedVideoUrl) {
      showError("Please enter a valid video URL.");
      return;
    }

    try {
      await onSubmit(trimmedContent, notify, normalizedVideoUrl ?? undefined);
      setContent("");
      setVideoUrl("");
      setIsExpanded(false);
      setMode("write");
      showSuccess("Update posted successfully!");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to post update. Please try again.");
    }
  };

  const handleCancel = () => {
    setContent("");
    setVideoUrl("");
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
      className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm ring-1 ring-zinc-900/5 transition-all duration-300 dark:border-zinc-700 dark:bg-zinc-800"
    >
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-purple-500 to-blue-500 text-xs font-bold text-white">
            {creatorAddress.slice(1, 3).toUpperCase()}
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Post an Update</h3>
        </div>
        {!isExpanded && (
          <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            Visible to all contributors
          </span>
        )}
      </div>

      {!isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="group w-full rounded-2xl border-2 border-dashed border-purple-200 bg-linear-to-r from-purple-600/10 to-blue-600/10 px-6 py-4 font-bold text-purple-700 transition-all duration-300 hover:from-purple-600/20 hover:to-blue-600/20 dark:border-purple-800 dark:text-purple-300"
        >
          <span className="inline-block transition-transform duration-200 group-hover:scale-110">
            {"\u270f\ufe0f"}
          </span>{" "}
          Write an update to your supporters...
        </button>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-2 dark:border-zinc-700">
            <div className="flex gap-1">
              {(["write", "preview"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    mode === m
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                      : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
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
                      className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {mode === "write" ? (
            <div className="space-y-4">
              <div className="relative">
                <label htmlFor={`update-content-${campaignId}`} className="sr-only">
                  Update content
                </label>
                <textarea
                  ref={textareaRef}
                  id={`update-content-${campaignId}`}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Share progress, milestones, or news... Markdown is supported."
                  rows={5}
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-sm leading-relaxed text-zinc-900 transition-all placeholder-zinc-400 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/50 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:ring-purple-400/50"
                  autoFocus
                />
                <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Supports markdown: **bold**, _italic_, ## headings, - lists and [links](url).
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor={`update-video-url-${campaignId}`}
                  className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                >
                  <Video className="h-4 w-4 text-purple-600 dark:text-purple-400" aria-hidden="true" />
                  Video URL
                </label>
                <input
                  id={`update-video-url-${campaignId}`}
                  type="url"
                  inputMode="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="Paste a YouTube, Mux, or direct video link"
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-3 text-sm text-zinc-900 transition-all placeholder-zinc-400 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/50 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:ring-purple-400/50"
                />
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Optional. Paste a YouTube watch link or a hosted video file URL.
                </p>
              </div>
            </div>
          ) : (
            <div
              className="min-h-[140px] rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-700 dark:bg-zinc-900/50"
              data-testid="update-preview"
            >
              <div className="space-y-4">
                {content.trim() ? (
                  <SafeMarkdown className="prose prose-sm prose-zinc max-w-none break-words dark:prose-invert">
                    {content}
                  </SafeMarkdown>
                ) : (
                  <p className="text-sm text-zinc-400 dark:text-zinc-500">
                    Nothing to preview yet - switch to Write and start typing.
                  </p>
                )}

                {normalizedVideoUrl && (
                  <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-black dark:border-zinc-700">
                    {youtubeEmbedUrl ? (
                      <iframe
                        src={youtubeEmbedUrl}
                        title="Video preview"
                        className="aspect-video w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    ) : isDirectVideoUrl(normalizedVideoUrl) ? (
                      <video controls preload="metadata" className="aspect-video w-full bg-black">
                        <source src={normalizedVideoUrl} />
                        Your browser does not support embedded video playback.
                      </video>
                    ) : (
                      <a
                        href={normalizedVideoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block px-4 py-3 text-sm text-white underline"
                      >
                        Open video link
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <label className="group relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={notify}
                  onChange={(e) => setNotify(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="relative h-6 w-11 rounded-full bg-zinc-200 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:content-[''] after:transition-all peer peer-focus:outline-none peer-checked:bg-purple-600 peer-checked:after:translate-x-full dark:bg-zinc-700"></div>
                <span className="ml-3 text-xs font-semibold text-zinc-700 transition-colors group-hover:text-zinc-900 dark:text-zinc-300 dark:group-hover:text-zinc-100">
                  Email contributors
                </span>
              </label>
            </div>

            <div className="flex flex-col items-start gap-1 sm:items-end">
              <span
                className={`text-[10px] font-mono tracking-tight ${
                  isOverLimit ? "text-red-500" : isUnderMinLength ? "text-amber-500" : "text-zinc-500"
                }`}
              >
                {characterCount}/{MAX_CONTENT_LENGTH}
              </span>
              {characterCount > 0 && isUnderMinLength && (
                <span className="text-[11px] text-amber-600 dark:text-amber-400">
                  {MIN_CONTENT_LENGTH - characterCount} more characters needed
                </span>
              )}
              {isOverLimit && (
                <span className="text-[11px] text-red-600 dark:text-red-400">
                  {characterCount - MAX_CONTENT_LENGTH} over limit
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              disabled={!canSubmit}
              isLoading={isSubmitting}
              loadingLabel="Posting..."
              fullWidth
              className="flex-1 bg-linear-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700"
            >
              Post Update
            </Button>
            <Button type="button" variant="secondary" onClick={handleCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
