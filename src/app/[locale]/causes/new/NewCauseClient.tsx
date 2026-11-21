"use client";

import { useTranslations } from "next-intl";
import SafeMarkdown from "@/components/SafeMarkdown";
import CampaignReviewModal from "@/components/CampaignReviewModal";
import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { validateImageFile } from "@/lib/imageValidation";
import { optimizeCoverImage } from "@/lib/imageOptimization";
import { cropCoverToAspect } from "@/lib/coverCrop";
import { useToast } from "@/components/ToastProvider";
import { useWallet } from "@/components/WalletContext";
import { useRouter } from "@/i18n/routing";
import {
  createCampaign,
  getFundingGoalBounds,
  getPlatformStatus,
  setMilestones,
  milestoneFormEntriesToInputs,
  addCampaignTag,
  type TransactionLifecyclePhase,
} from "@/lib/contractClient";
import { invalidateCampaignsList } from "@/lib/cacheInvalidation";
import { Category, CATEGORY_LABELS } from "@/types";
import { xlmToStroops } from "@/lib/stellarAmount";
import { fundingGoalBoundsError, formatGoalStroops } from "@/utils/validators";
import { usePlatformStatus } from "@/hooks/usePlatformStatus";
import { parseContractError } from "@/utils/contractErrors";
import { signOffchainPayload } from "@/lib/offchainApiClient";
import { useCampaignFormDraft } from "@/hooks/useCampaignFormDraft";
import { CheckCircle2 } from "lucide-react";
import {
  validateForm,
  validateMaxContributionPerWallet,
  type FormErrorKeys,
  type ReviewData,
} from "@/lib/campaignValidation";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateCampaignPage() {
  const t = useTranslations("CreateCampaign");
  const tAccessibility = useTranslations("Accessibility");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { publicKey, isWalletConnected, connectWallet, isLoading: walletLoading } = useWallet();
  const { showError, showSuccess, showWarning } = useToast();
  const { isPaused, isCreationDisabled, isCreationBlocked, isLoading: statusLoading, isError: statusError } =
    usePlatformStatus();
  const { data: goalBounds, isPending: goalBoundsLoading, isError: goalBoundsLoadError } = useQuery({
    queryKey: ["campaignFundingGoalBounds"],
    queryFn: () => getFundingGoalBounds(),
    staleTime: 30_000,
    retry: 1,
  });

  // ── Form state ──
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionEs, setDescriptionEs] = useState("");
  const [creatorEmail, setCreatorEmail] = useState("");
  const [fundingGoal, setFundingGoal] = useState("");
  const [campaignToken, setCampaignToken] = useState("");
  const [durationDays, setDurationDays] = useState("");
  // Optional per-wallet cap in XLM. Blank means no cap, which the contract stores as 0.
  const [maxContributionPerWallet, setMaxContributionPerWallet] = useState("");
  const [category, setCategory] = useState<Category>(Category.Learner);
  const [hasRevenueSharing, setHasRevenueSharing] = useState(false);
  // Keep revenue share in integer basis points (bps) to avoid float values
  // reaching the Soroban u32 contract argument. 500 bps = 5%.
  const [revenueShareBps, setRevenueShareBps] = useState(500);
  // Percentage is derived only for existing validation, draft compatibility and display.
  const revenueSharePercentage = revenueShareBps / 100;
  const [errorKeys, setErrorKeys] = useState<FormErrorKeys>({});
  const [goalRangeError, setGoalRangeError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [milestones, setMilestoneForm] = useState<{ targetAmount: string; description: string }[]>(
    [],
  );
  const [tagInput, setTagInput] = useState("");
  const [descriptionTab, setDescriptionTab] = useState<"write" | "preview">("write");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  // Local thumbnail of the file being uploaded, shown before the IPFS URL exists.
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!coverPreviewUrl) return;
    return () => URL.revokeObjectURL(coverPreviewUrl);
  }, [coverPreviewUrl]);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
