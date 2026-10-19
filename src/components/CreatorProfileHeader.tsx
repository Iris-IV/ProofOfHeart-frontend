"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { BadgeCheck, Globe, ImagePlus, Pencil } from "lucide-react";
import {
  BANNER_TYPES,
  MAX_BANNER_BYTES,
  PROFILE_LINKS,
  EMPTY_CREATOR_PROFILE,
  creatorProfileKey,
  isSafeProfileLink,
  parseCreatorProfile,
  saveCreatorProfile,
  type CreatorProfile,
} from "@/lib/creatorProfile";
import { getRawItem } from "@/lib/localStorageStore";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("poh:creator-profile-changed", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("poh:creator-profile-changed", callback);
  };
}

export default function CreatorProfileHeader({
  address,
  verifiedCampaignCount,
  children,
}: {
  address: string;
  verifiedCampaignCount: number;
  children?: ReactNode;
}) {
  const t = useTranslations("CreatorProfile");
  const id = useId();
  const raw = useSyncExternalStore(
    subscribe,
    () => getRawItem(creatorProfileKey(address)),
    () => null,
  );
  const saved = useMemo(() => parseCreatorProfile(raw), [raw]);
  const [draft, setDraft] = useState<CreatorProfile>(EMPTY_CREATOR_PROFILE);
  const [editing, setEditing] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const readerRef = useRef<FileReader | null>(null);
  useEffect(() => () => readerRef.current?.abort(), []);
  const profile = editing ? draft : saved;
  const fieldClass =
    "tap-target focus-ring w-full rounded-control border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50";

  function stopReading() {
    readerRef.current?.abort();
    readerRef.current = null;
    setReading(false);
  }

  function previewBanner(file?: File) {
    if (!file) return;
    stopReading();
    if (!BANNER_TYPES.includes(file.type) || file.size > MAX_BANNER_BYTES) {
      setError(t("invalidBanner"));
      return;
    }
    setError(null);
    setReading(true);
    const reader = new FileReader();
    readerRef.current = reader;
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const banner = reader.result;
        setDraft((current) => ({ ...current, banner }));
      }
      setReading(false);
    };
    reader.onerror = () => {
      setError(t("invalidBanner"));
      setReading(false);
    };
    reader.readAsDataURL(file);
  }

  return (
    <section
      aria-label={t("title")}
      className="mb-8 overflow-hidden rounded-surface border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div className="relative h-36 bg-linear-to-r from-brand/20 to-accent/20 sm:h-48">
        {profile.banner && (
          <Image
            src={profile.banner}
            alt={t("bannerAlt")}
            fill
            unoptimized
            sizes="(max-width: 896px) 100vw, 896px"
            className="object-cover"
          />
        )}
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(saved);
              setEditing(true);
              setError(null);
              setSavedNotice(false);
            }}
            className="tap-target focus-ring absolute right-3 top-3 flex items-center gap-2 rounded-control bg-white/95 px-3 py-2 text-sm font-semibold text-zinc-900 backdrop-blur-sm transition-colors duration-[140ms] hover:bg-white motion-reduce:transition-none dark:bg-zinc-900/95 dark:text-zinc-50"
          >
            <Pencil size={16} aria-hidden="true" />
            {t("edit")}
          </button>
        )}
      </div>
      <div className="p-4 sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-white"
          >
            {(profile.displayName || address.slice(1, 3)).slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-heading-lg font-heading-lg text-zinc-900 dark:text-zinc-50">
              {profile.displayName || t("title")}
            </h1>
            <p
              className="mt-1 break-all font-mono text-xs text-zinc-600 dark:text-zinc-300"
              title={address}
            >
              {address}
            </p>
            {verifiedCampaignCount > 0 && (
              <p
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-green-800 dark:text-green-300"
                title={t("verifiedHelp")}
              >
                <BadgeCheck size={16} aria-hidden="true" />
                {t("verified", { count: verifiedCampaignCount })}
              </p>
            )}
            <nav aria-label={t("socialLinks")} className="mt-2 flex flex-wrap gap-x-4">
              {PROFILE_LINKS.map(
                (name) =>
                  profile.links[name] && (
                    <a
                      key={name}
                      href={profile.links[name]}
                      target="_blank"
                      rel="noopener noreferrer me"
                      className="tap-target focus-ring inline-flex items-center gap-1.5 break-all text-sm font-medium text-brand underline-offset-4 hover:underline dark:text-blue-300"
                    >
                      <Globe size={14} aria-hidden="true" />
                      {t(name)}
                      <span className="sr-only"> {t("opensNewTab")}</span>
                    </a>
                  ),
              )}
            </nav>
          </div>
        </div>
        {children}
        {savedNotice && (
          <p role="status" className="mt-4 text-sm text-green-800 dark:text-green-300">
            {t("saved")}
          </p>
        )}
        {editing && (
          <form
            className="mt-6 space-y-4 border-t border-zinc-200 pt-6 dark:border-zinc-700"
            onSubmit={(event) => {
              event.preventDefault();
              if (reading) return;
              if (PROFILE_LINKS.some((name) => !isSafeProfileLink(draft.links[name].trim()))) {
                setError(t("invalidLink"));
                return;
              }
              try {
                saveCreatorProfile(address, draft);
                setEditing(false);
                setError(null);
                setSavedNotice(true);
              } catch {
                setError(t("saveError"));
              }
            }}
          >
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{t("localOnly")}</p>
            <div>
              <label htmlFor={`${id}-name`} className="mb-1 block text-sm font-medium">
                {t("displayName")}
              </label>
              <input
                id={`${id}-name`}
                value={draft.displayName}
                maxLength={80}
                onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label
                htmlFor={`${id}-banner`}
                className="mb-1 flex items-center gap-2 text-sm font-medium"
              >
                <ImagePlus size={16} aria-hidden="true" />
                {t("banner")}
              </label>
              <input
                id={`${id}-banner`}
                type="file"
                accept={BANNER_TYPES.join(",")}
                aria-describedby={`${id}-banner-help`}
                onChange={(event) => {
                  previewBanner(event.target.files?.[0]);
                  event.target.value = "";
                }}
                className="tap-target focus-ring block w-full min-w-0 text-sm file:mr-3 file:rounded-control file:border-0 file:bg-brand-subtle file:px-3 file:py-3 file:text-brand"
              />
              <p id={`${id}-banner-help`} className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                {t("bannerHelp")}
              </p>
              {draft.banner && (
                <button
                  type="button"
                  onClick={() => {
                    stopReading();
                    setDraft({ ...draft, banner: "" });
                  }}
                  className="tap-target focus-ring text-sm font-medium text-brand dark:text-blue-300"
                >
                  {t("removeBanner")}
                </button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {PROFILE_LINKS.map((name) => (
                <div key={name}>
                  <label htmlFor={`${id}-${name}`} className="mb-1 block text-sm font-medium">
                    {t(name)}
                  </label>
                  <input
                    id={`${id}-${name}`}
                    type="url"
                    inputMode="url"
                    maxLength={2048}
                    placeholder="https://"
                    value={draft.links[name]}
                    onChange={(event) =>
                      setDraft({ ...draft, links: { ...draft.links, [name]: event.target.value } })
                    }
                    className={fieldClass}
                  />
                </div>
              ))}
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={reading}
                className="tap-target focus-ring rounded-control bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors duration-[140ms] hover:bg-brand-strong disabled:opacity-50 motion-reduce:transition-none"
              >
                {reading ? t("reading") : t("save")}
              </button>
              <button
                type="button"
                onClick={() => {
                  stopReading();
                  setEditing(false);
                  setError(null);
                }}
                className="tap-target focus-ring rounded-control px-5 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
