"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { validateImageUrl } from "@/lib/imageValidation";

interface Props {
  campaignId: number;
  initialTitle: string;
  initialDescription: string;
  initialCoverImageUrl: string;
}

interface MetaOverride {
  title: string;
  description: string;
  coverImageUrl: string;
  editedAt: string;
}

export default function EditCampaignMetadata({
  campaignId,
  initialTitle,
  initialDescription,
  initialCoverImageUrl,
}: Props) {
  const t = useTranslations("EditCampaignMetadata");
  const storageKey = `poh_meta_override_${campaignId}`;

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [coverImageUrl, setCoverImageUrl] = useState(initialCoverImageUrl);
  const [override, setOverride] = useState<MetaOverride | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed: MetaOverride = JSON.parse(raw);
        setOverride(parsed);
        setTitle(parsed.title);
        setDescription(parsed.description);
        setCoverImageUrl(parsed.coverImageUrl);
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  const handleSave = () => {
    // Validate the cover image URL before saving
    if (coverImageUrl) {
      const { valid, error } = validateImageUrl(coverImageUrl);
      if (!valid) {
        setImageError(error || "Invalid image URL");
        return;
      }
    }
    setImageError(null);

    const data: MetaOverride = {
      title,
      description,
      coverImageUrl,
      editedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
      setOverride(data);
    } catch {
      // ignore
    }
  };

  const handleClear = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setOverride(null);
    setImageError(null);
    setTitle(initialTitle);
    setDescription(initialDescription);
    setCoverImageUrl(initialCoverImageUrl);
  };

  const titleId = `edit-title-${campaignId}`;
  const descriptionId = `edit-description-${campaignId}`;
  const coverImageId = `edit-cover-image-url-${campaignId}`;

  const handleImageUrlChange = (url: string) => {
    setCoverImageUrl(url);
    // Clear error when the user starts typing
    if (imageError) {
      setImageError(null);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 rounded-xl transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          {/* Pencil icon */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          {t("editMetadata")}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2">
            {t("note")}
          </p>

          {/* Title */}
          <div>
            <label
              htmlFor={`edit-meta-title-${campaignId}`}
              className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1"
            >
              {t("titleLabel")}
            </label>
            <input
              id={`edit-meta-title-${campaignId}`}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor={`edit-meta-description-${campaignId}`}
              className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1"
            >
              {t("descriptionLabel")}
            </label>
            <textarea
              id={`edit-meta-description-${campaignId}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>

          {/* Cover image URL */}
          <div>
            <label
              htmlFor={`edit-meta-cover-${campaignId}`}
              className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1"
            >
              {t("coverImageUrlLabel")}
            </label>
            <input
              id={`edit-meta-cover-${campaignId}`}
              type="url"
              value={coverImageUrl}
              onChange={(e) => handleImageUrlChange(e.target.value)}
              aria-invalid={imageError ? true : undefined}
              aria-describedby={imageError ? "cover-image-error" : undefined}
              className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                imageError
                  ? "border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-900/20 text-red-900 dark:text-red-200"
                  : "border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50"
              }`}
            />
            {imageError && (
              <p
                id="cover-image-error"
                role="alert"
                className="mt-1 text-xs text-red-600 dark:text-red-400"
              >
                {imageError}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={!!imageError}
            className="self-start px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("saveButton")}
          </button>

          {/* Audit trail */}
          {override && (
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span>
                {t("lastEdited")}{" "}
                <time dateTime={override.editedAt}>
                  {new Date(override.editedAt).toLocaleString()}
                </time>
              </span>
              <button
                type="button"
                onClick={handleClear}
                className="ml-4 text-red-500 hover:text-red-600 font-medium transition-colors"
              >
                {t("clearEdits")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
