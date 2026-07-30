"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
          const parsed = JSON.parse(saved) as Partial<CampaignFormDraftData>;
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
