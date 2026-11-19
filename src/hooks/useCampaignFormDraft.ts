"use client";

import { useState, useCallback, useRef } from "react";
import { Category } from "@/types";

export interface CampaignFormDraftData {
  title: string;
  description: string;
  descriptionEs: string;
  creatorEmail: string;
  fundingGoal: string;
  durationDays: string;
  category: Category;
  hasRevenueSharing: boolean;
  revenueSharePercentage: number;
  tags: string[];
  coverImageUrl: string;
  milestones: { targetAmount: string; description: string }[];
  /** Per-wallet cap in XLM as typed. Empty means no cap. */
  maxContributionPerWallet?: string;
}

export interface CampaignFormSetters {
  setTitle: (v: string) => void;
  setDescription: (v: string) => void;
  setDescriptionEs: (v: string) => void;
  setCreatorEmail: (v: string) => void;
  setFundingGoal: (v: string) => void;
  setDurationDays: (v: string) => void;
  setCategory: (v: Category) => void;
  setHasRevenueSharing: (v: boolean) => void;
  setRevenueSharePercentage: (v: number) => void;
  setTags: (v: string[]) => void;
  setCoverImageUrl: (v: string) => void;
  setMilestones: (v: { targetAmount: string; description: string }[]) => void;
  setMaxContributionPerWallet?: (v: string) => void;
}

interface UseCampaignFormDraftOptions {
  publicKey: string | null;
}

interface UseCampaignFormDraftReturn {
  hasDraft: boolean;
  lastSavedAt: number | null;
  restoreDraft: (setters: CampaignFormSetters) => void;
  saveDraft: (data: CampaignFormDraftData) => void;
  discardDraft: (resetters: CampaignFormSetters) => void;
  clearDraft: () => void;
}

/** Keys that can alter object prototypes if copied or merged from untrusted input. */
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const MAX_TAGS = 20;
const MAX_MILESTONES = 50;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asCategory(value: unknown): Category | undefined {
  return (Object.values(Category) as unknown[]).includes(value) ? (value as Category) : undefined;
}

function sanitizeTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((tag): tag is string => typeof tag === "string").slice(0, MAX_TAGS);
}

function sanitizeMilestones(value: unknown): CampaignFormDraftData["milestones"] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter(isRecord)
    .slice(0, MAX_MILESTONES)
    .map((milestone) => ({
      targetAmount: asString(milestone.targetAmount) ?? "",
      description: asString(milestone.description) ?? "",
    }));
}

/**
 * Rebuilds a draft from untrusted storage contents. Only whitelisted keys are
 * read and each value is type-checked, so unknown or prototype-polluting keys
 * are never copied onto the returned object.
 */
export function sanitizeCampaignDraft(raw: unknown): Partial<CampaignFormDraftData> {
  if (!isRecord(raw)) return {};

  const draft: Partial<CampaignFormDraftData> = {};
  const title = asString(raw.title);
  const description = asString(raw.description);
  const descriptionEs = asString(raw.descriptionEs);
  const creatorEmail = asString(raw.creatorEmail);
  const fundingGoal = asString(raw.fundingGoal);
  const durationDays = asString(raw.durationDays);
  const category = asCategory(raw.category);
  const hasRevenueSharing = asBoolean(raw.hasRevenueSharing);
  const revenueSharePercentage = asFiniteNumber(raw.revenueSharePercentage);
  const tags = sanitizeTags(raw.tags);
  const coverImageUrl = asString(raw.coverImageUrl);
  const milestones = sanitizeMilestones(raw.milestones);
  const maxContributionPerWallet = asString(raw.maxContributionPerWallet);

  if (title !== undefined) draft.title = title;
  if (description !== undefined) draft.description = description;
  if (descriptionEs !== undefined) draft.descriptionEs = descriptionEs;
  if (creatorEmail !== undefined) draft.creatorEmail = creatorEmail;
  if (fundingGoal !== undefined) draft.fundingGoal = fundingGoal;
  if (durationDays !== undefined) draft.durationDays = durationDays;
  if (category !== undefined) draft.category = category;
  if (hasRevenueSharing !== undefined) draft.hasRevenueSharing = hasRevenueSharing;
  if (revenueSharePercentage !== undefined) draft.revenueSharePercentage = revenueSharePercentage;
  if (tags !== undefined) draft.tags = tags;
  if (coverImageUrl !== undefined) draft.coverImageUrl = coverImageUrl;
  if (milestones !== undefined) draft.milestones = milestones;
  if (maxContributionPerWallet !== undefined) {
    draft.maxContributionPerWallet = maxContributionPerWallet;
  }

  return draft;
}

/**
 * Parses stored draft JSON. The reviver drops forbidden keys at every depth
 * before any value reaches application code.
 */
export function parseCampaignDraft(serialized: string): Partial<CampaignFormDraftData> {
  const parsed: unknown = JSON.parse(serialized, (key, value: unknown) =>
    FORBIDDEN_KEYS.has(key) ? undefined : value,
  );
  return sanitizeCampaignDraft(parsed);
}

export function useCampaignFormDraft({
  publicKey,
}: UseCampaignFormDraftOptions): UseCampaignFormDraftReturn {
  const draftKey = publicKey
    ? `proof_of_heart_draft_${publicKey}`
    : "proof_of_heart_draft_anonymous";

  const [hasDraft, setHasDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const hasRestored = useRef(false);

  const restoreDraft = useCallback(
    (setters: CampaignFormSetters) => {
      try {
        const saved = localStorage.getItem(draftKey);
        if (saved) {
          const parsed = parseCampaignDraft(saved);
          if (parsed.title) setters.setTitle(parsed.title);
          if (parsed.description) setters.setDescription(parsed.description);
          if (parsed.descriptionEs) setters.setDescriptionEs(parsed.descriptionEs);
          if (parsed.creatorEmail) setters.setCreatorEmail(parsed.creatorEmail);
          if (parsed.fundingGoal) setters.setFundingGoal(parsed.fundingGoal);
          if (parsed.durationDays) setters.setDurationDays(parsed.durationDays);
          if (parsed.category !== undefined) setters.setCategory(parsed.category);
          if (parsed.hasRevenueSharing !== undefined)
            setters.setHasRevenueSharing(parsed.hasRevenueSharing);
          if (parsed.revenueSharePercentage !== undefined)
            setters.setRevenueSharePercentage(parsed.revenueSharePercentage);
          if (parsed.tags) setters.setTags(parsed.tags);
          if (parsed.coverImageUrl) setters.setCoverImageUrl(parsed.coverImageUrl);
          if (parsed.milestones) setters.setMilestones(parsed.milestones);
          if (parsed.maxContributionPerWallet && setters.setMaxContributionPerWallet)
            setters.setMaxContributionPerWallet(parsed.maxContributionPerWallet);
          setHasDraft(true);
        }
      } catch (e) {
        console.warn("Failed to load draft from localStorage:", e);
      }
      hasRestored.current = true;
    },
    [draftKey],
  );

  const saveDraft = useCallback(
    (data: CampaignFormDraftData) => {
      // Guard: don't save before the draft has been restored, to avoid
      // overwriting a saved draft with empty default values on first render.
      if (!hasRestored.current) return;
      try {
        localStorage.setItem(draftKey, JSON.stringify(data));
        setLastSavedAt(Date.now());
        setHasDraft(true);
      } catch (e) {
        console.warn("Failed to save draft to localStorage:", e);
      }
    },
    [draftKey],
  );

  const discardDraft = useCallback(
    (resetters: CampaignFormSetters) => {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
      resetters.setTitle("");
      resetters.setDescription("");
      resetters.setDescriptionEs("");
      resetters.setCreatorEmail("");
      resetters.setFundingGoal("");
      resetters.setDurationDays("");
      resetters.setCategory(Category.Learner);
      resetters.setHasRevenueSharing(false);
      resetters.setRevenueSharePercentage(5);
      resetters.setTags([]);
      resetters.setCoverImageUrl("");
      resetters.setMilestones([]);
      setHasDraft(false);
      setLastSavedAt(null);
    },
    [draftKey],
  );

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
  }, [draftKey]);

  return { hasDraft, lastSavedAt, restoreDraft, saveDraft, discardDraft, clearDraft };
}
