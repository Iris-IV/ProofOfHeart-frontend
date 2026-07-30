import { Category } from "@/types";

export interface FormErrorKeys {
  title?: string;
  description?: string;
  descriptionEs?: string;
  creatorEmail?: string;
  fundingGoal?: string;
  durationDays?: string;
  revenueSharePercentage?: string;
  coverImageUrl?: string;
}

export interface ReviewData {
  title: string;
  description: string;
  creatorEmail: string;
  fundingGoalXlm: number;
  durationDays: number;
  category: Category;
  hasRevenueSharing: boolean;
  revenueSharePercentage: number;
  estimatedDeadlineTimestamp: number;
  tags: string[];
  coverImageUrl: string;
  milestones: { targetAmount: bigint; description: string }[];
}

const IMAGE_URL_RE = /^https?:\/\/.+\..+/;

/** Returns translation keys for any validation errors, or an empty object if valid. */
export function validateForm(
  title: string,
  description: string,
  descriptionEs: string,
  creatorEmail: string,
  fundingGoal: string,
  durationDays: string,
  hasRevenueSharing: boolean,
  revenueSharePercentage: number,
  coverImageUrl: string,
): FormErrorKeys {
  const errors: FormErrorKeys = {};

  if (title.trim().length < 1) {
    errors.title = "validationTitleRequired";
  } else if (title.trim().length > 100) {
    errors.title = "validationTitleTooLong";
  }

  if (description.trim().length < 1) {
    errors.description = "validationDescriptionRequired";
  } else if (description.trim().length > 1000) {
    errors.description = "validationDescriptionTooLong";
  }

  if (descriptionEs.trim().length > 1000) {
    errors.descriptionEs = "validationDescriptionEsTooLong";
  }

  if (creatorEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(creatorEmail.trim())) {
    errors.creatorEmail = "validationCreatorEmailInvalid";
  }

  const goal = parseFloat(fundingGoal);
  if (!fundingGoal || isNaN(goal) || goal <= 0) {
    errors.fundingGoal = "validationFundingGoalInvalid";
  }

  const days = parseInt(durationDays, 10);
  if (!durationDays || isNaN(days) || days < 1 || days > 365) {
    errors.durationDays = "validationDurationInvalid";
  }

  if (hasRevenueSharing && (revenueSharePercentage < 0.01 || revenueSharePercentage > 50)) {
    errors.revenueSharePercentage = "validationRevenueShareInvalid";
  }

  if (coverImageUrl.trim() && !IMAGE_URL_RE.test(coverImageUrl.trim())) {
    errors.coverImageUrl = "validationCoverImageInvalid";
  }

  return errors;
}
