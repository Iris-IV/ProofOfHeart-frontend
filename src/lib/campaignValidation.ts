import { Category } from "@/types";
import type { Campaign } from "@/types";
import { parseSorobanError, SorobanContractError } from "./stellar";

export interface FormErrorKeys {
  title?: string;
  description?: string;
  descriptionEs?: string;
  creatorEmail?: string;
  fundingGoal?: string;
  durationDays?: string;
  maxContributionPerWallet?: string;
  revenueSharePercentage?: string;
  coverImageUrl?: string;
  coverImageAltText?: string;
}

// ---------------------------------------------------------------------------
// IPFS metadata hash validation (#1534)
//
// Validates that off-chain IPFS metadata matches the on-chain campaign state.
// When campaigns store a metadata hash on-chain, this validates the fetched
// IPFS content against that hash before rendering.
// ---------------------------------------------------------------------------

/** Metadata fields that can be hashed for verification. */
export interface CampaignMetadata {
  title: string;
  description: string;
  coverImageUrl?: string;
  tags?: string[];
  milestones?: { targetAmount: bigint; description: string }[];
}

/** Result of metadata hash validation. */
export interface MetadataValidationResult {
  /** True when the computed hash matches the expected on-chain hash. */
  valid: boolean;
  /** The computed hash of the metadata. */
  computedHash?: string;
  /** The expected hash from on-chain state. */
  expectedHash?: string;
  /** Why validation failed; absent when valid. */
  reason?: "hash_mismatch" | "missing_expected_hash" | "invalid_metadata";
}

/**
 * Computes a SHA-256 hash of campaign metadata for verification against
 * on-chain state. Serializes the metadata canonically (sorted keys, stable
 * bigint encoding) so the hash is deterministic.
 */
export async function computeMetadataHash(metadata: CampaignMetadata): Promise<string> {
  const canonical = JSON.stringify(
    {
      title: metadata.title,
      description: metadata.description,
      coverImageUrl: metadata.coverImageUrl ?? null,
      tags: metadata.tags ?? [],
      milestones:
        metadata.milestones?.map((m) => ({
          targetAmount: m.targetAmount.toString(),
          description: m.description,
        })) ?? [],
    },
    null,
    0,
  );

  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Validates that the campaign's metadata hash matches the expected on-chain
 * hash. Returns a validation result indicating whether the metadata is
 * trustworthy.
 *
 * When the campaign does not carry an on-chain hash (older campaigns or
 * contracts without hash storage), validation is skipped and the result is
 * marked valid with a reason.
 */
export async function validateCampaignMetadataHash(
  campaign: Campaign,
  expectedHash?: string,
): Promise<MetadataValidationResult> {
  if (!expectedHash) {
    // No on-chain hash to validate against. This is expected for campaigns
    // created before hash validation was added, or when the contract does not
    // store metadata hashes. Mark as valid with a note.
    return { valid: true, reason: "missing_expected_hash" };
  }

  try {
    const metadata: CampaignMetadata = {
      title: campaign.title,
      description: campaign.description,
      coverImageUrl: campaign.cover_image_url,
      tags: campaign.tags,
      milestones: campaign.milestones,
    };

    const computedHash = await computeMetadataHash(metadata);

    if (computedHash !== expectedHash) {
      return {
        valid: false,
        computedHash,
        expectedHash,
        reason: "hash_mismatch",
      };
    }

    return { valid: true, computedHash, expectedHash };
  } catch {
    return { valid: false, reason: "invalid_metadata" };
  }
}

/**
 * Wraps a contract interaction error into a typed SorobanContractError for
 * consistent error handling across the UI. Custom/unknown contract error
 * codes are preserved and mapped to user-facing messages.
 */
export function handleContractError(error: unknown, locale: string = "en"): SorobanContractError {
  return parseSorobanError(error, locale);
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
  coverImageAltText?: string;
  milestones: { targetAmount: bigint; description: string }[];
  /** Per-wallet cap in XLM as typed. Empty or absent means no cap. */
  maxContributionPerWallet?: string;
}

/** Up to 7 decimal places, matching the stroop precision `xlmToStroops` accepts. */
const XLM_AMOUNT_RE = /^\d+(\.\d{1,7})?$/;

/**
 * Validates the optional per-wallet cap. Blank means no cap, which the contract
 * stores as `0`. Anything else must be a non-negative XLM amount.
 */
export function validateMaxContributionPerWallet(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || XLM_AMOUNT_RE.test(trimmed)) return undefined;
  return "validationMaxContributionInvalid";
}

const IMAGE_URL_RE = /^https?:\/\/.+\..+/;
const GENERIC_ALT_PATTERNS = [
  /^image$/i,
  /^photo$/i,
  /^picture$/i,
  /^cover$/i,
  /^img$/i,
  /^upload$/i,
  /^media$/i,
  /^dsc_\d+$/i,
  /^img_\d+$/i,
];

/**
 * Validates accessibility alt text for creator uploaded media.
 */
export function validateAltText(altText: string): { valid: boolean; errorKey?: string } {
  const trimmed = altText ? altText.trim() : "";

  if (!trimmed) {
    return { valid: false, errorKey: "validationAltTextRequired" };
  }

  // The generic-term rule runs before the length rules so that short generic
  // words like "img" are reported as generic rather than "too short".
  if (GENERIC_ALT_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return { valid: false, errorKey: "validationAltTextGeneric" };
  }

  if (trimmed.length < 5) {
    return { valid: false, errorKey: "validationAltTextTooShort" };
  }

  if (trimmed.length > 150) {
    return { valid: false, errorKey: "validationAltTextTooLong" };
  }

  return { valid: true };
}

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
  coverImageAltText?: string,
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

  if (coverImageUrl.trim()) {
    if (!IMAGE_URL_RE.test(coverImageUrl.trim())) {
      errors.coverImageUrl = "validationCoverImageInvalid";
    }
    // Alt text validation is required whenever cover image URL is present
    const altCheck = validateAltText(coverImageAltText || "");
    if (!altCheck.valid) {
      errors.coverImageAltText = altCheck.errorKey;
    }
  }

  return errors;
}
