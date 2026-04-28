'use client';

import { useTranslations } from 'next-intl';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { useState, useEffect } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useWallet } from '@/components/WalletContext';
import { useRouter } from '@/i18n/routing';
import { createCampaign, getCampaignCount } from '@/lib/contractClient';
import { Category, CATEGORY_LABELS, xlmToStroops } from '@/types';
import { parseContractError } from '@/utils/contractErrors';

// ---------------------------------------------------------------------------
// Validation — returns translation keys instead of hardcoded strings
// ---------------------------------------------------------------------------

interface FormErrorKeys {
  title?: string;
  description?: string;
  creatorEmail?: string;
  fundingGoal?: string;
  durationDays?: string;
  revenueSharePercentage?: string;
  coverImageUrl?: string;
}

interface ReviewData {
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
}

const IMAGE_URL_RE = /^https?:\/\/.+\..+/;

function validateForm(
  title: string,
  description: string,
  creatorEmail: string,
  fundingGoal: string,
  durationDays: string,
  hasRevenueSharing: boolean,
  revenueSharePercentage: number,
  tags: string[],
  coverImageUrl: string,
): FormErrorKeys {
  const errors: FormErrorKeys = {};

  if (title.trim().length < 1) {
    errors.title = 'validationTitleRequired';
  } else if (title.trim().length > 100) {
    errors.title = 'validationTitleTooLong';
  }

  if (description.trim().length < 1) {
    errors.description = 'validationDescriptionRequired';
  } else if (description.trim().length > 1000) {
    errors.description = 'validationDescriptionTooLong';
  }

  if (creatorEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(creatorEmail.trim())) {
    errors.creatorEmail = 'validationCreatorEmailInvalid';
  }

  const goal = parseFloat(fundingGoal);
  if (!fundingGoal || isNaN(goal) || goal <= 0) {
    errors.fundingGoal = 'validationFundingGoalInvalid';
  }

  const days = parseInt(durationDays, 10);
  if (!durationDays || isNaN(days) || days < 1 || days > 365) {
    errors.durationDays = 'validationDurationInvalid';
  }

  if (hasRevenueSharing && (revenueSharePercentage < 0.01 || revenueSharePercentage > 50)) {
    errors.revenueSharePercentage = 'validationRevenueShareInvalid';
  }

  if (coverImageUrl.trim() && !IMAGE_URL_RE.test(coverImageUrl.trim())) {
    errors.coverImageUrl = 'validationCoverImageInvalid';
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateCampaignPage() {
  const t = useTranslations('CreateCampaign');
  const router = useRouter();
  const { publicKey, isWalletConnected, connectWallet, isLoading: walletLoading } = useWallet();
  const { showError, showSuccess, showWarning } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creatorEmail, setCreatorEmail] = useState('');
  const [fundingGoal, setFundingGoal] = useState('');
  const [durationDays, setDurationDays] = useState('');
  const [category, setCategory] = useState<Category>(Category.Learner);
  const [hasRevenueSharing, setHasRevenueSharing] = useState(false);
  // #110 — default 5 % (500 bps); state is percent, converted to bps at submit
  const [revenueSharePercentage, setRevenueSharePercentage] = useState(5);
  const [errorKeys, setErrorKeys] = useState<FormErrorKeys>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [descriptionTab, setDescriptionTab] = useState<'write' | 'preview'>('write');
  const [coverImageUrl, setCoverImageUrl] = useState('');

  const DRAFT_KEY = 'proof_of_heart_next_draft';
  const CREATOR_EMAIL_WEBHOOK_URL =
    process.env.NEXT_PUBLIC_CREATOR_EMAIL_WEBHOOK_URL?.trim() ?? '';

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.description) setDescription(parsed.description);
        if (parsed.creatorEmail) setCreatorEmail(parsed.creatorEmail);
        if (parsed.fundingGoal) setFundingGoal(parsed.fundingGoal);
        if (parsed.durationDays) setDurationDays(parsed.durationDays);
        if (parsed.category !== undefined) setCategory(parsed.category);
        if (parsed.hasRevenueSharing !== undefined) setHasRevenueSharing(parsed.hasRevenueSharing);
        if (parsed.revenueSharePercentage !== undefined)
          setRevenueSharePercentage(parsed.revenueSharePercentage);
        if (parsed.tags) setTags(parsed.tags);
        if (parsed.coverImageUrl) setCoverImageUrl(parsed.coverImageUrl);
      }
    } catch (e) {
      console.warn('Failed to load draft from localStorage:', e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          title,
          description,
          creatorEmail,
          fundingGoal,
          durationDays,
          category,
          hasRevenueSharing,
          revenueSharePercentage,
          tags,
          coverImageUrl,
        }),
      );
    } catch (e) {
      console.warn('Failed to save draft to localStorage:', e);
    }
  }, [
    title,
    description,
    creatorEmail,
    fundingGoal,
    durationDays,
    category,
    hasRevenueSharing,
    revenueSharePercentage,
    tags,
  ]);

  const isStartup = category === Category.EducationalStartup;

  const handleCategoryChange = (val: Category) => {
    setCategory(val);
    if (val !== Category.EducationalStartup) {
      setHasRevenueSharing(false);
      setRevenueSharePercentage(1);
    }
  };

  const formatReviewDate = (timestamp: number) =>
    new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(timestamp * 1000));

  const notifyEmailOptIn = async (
    campaignId: number | null,
    email: string,
    campaignTitle: string,
    creatorAddress: string,
  ) => {
    if (!CREATOR_EMAIL_WEBHOOK_URL || !email) return;

    try {
      await fetch(CREATOR_EMAIL_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'campaign_creator_email_opt_in',
          email,
          campaignId,
          campaignTitle,
          creatorAddress,
          source: 'proof_of_heart_frontend',
          timestamp: new Date().toISOString(),
        }),
      });
    } catch {
      showWarning(t('emailWebhookFailed'));
    }
  };

  const handleConfirmAndSign = async () => {
    if (!reviewData) return;

    if (!isWalletConnected || !publicKey) {
      showError(t('walletRequiredError'));
      return;
    }

    setIsSubmitting(true);

    try {
      const fundingGoalStroops = xlmToStroops(reviewData.fundingGoalXlm);
      const basisPoints = reviewData.hasRevenueSharing
        ? Math.round(reviewData.revenueSharePercentage * 100)
        : 0;

      await createCampaign(
        publicKey,
        reviewData.title,
        reviewData.description,
        fundingGoalStroops,
        reviewData.durationDays,
        reviewData.category,
        reviewData.hasRevenueSharing,
        basisPoints,
        reviewData.tags,
      );

      let newCampaignId: number | null = null;
      try {
        newCampaignId = await getCampaignCount();
      } catch {
        // Ignore count lookup failures and continue with a generic redirect.
      }

      await notifyEmailOptIn(
        newCampaignId,
        reviewData.creatorEmail,
        reviewData.title,
        publicKey,
      );

      showSuccess(t('successMessage'));
      setIsReviewOpen(false);
      setReviewData(null);

      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }

      if (newCampaignId !== null) {
        router.push(`/causes/${newCampaignId}`);
      } else {
        router.push('/causes');
      }
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isWalletConnected || !publicKey) {
      showError(t('walletRequiredError'));
      return;
    }

    const keys = validateForm(
      title,
      description,
      creatorEmail,
      fundingGoal,
      durationDays,
      hasRevenueSharing,
      revenueSharePercentage,
      tags,
      coverImageUrl,
    );

    if (Object.keys(keys).length > 0) {
      setErrorKeys(keys);
      return;
    }

    setErrorKeys({});
    const parsedGoal = parseFloat(fundingGoal);
    const parsedDays = parseInt(durationDays, 10);

    setReviewData({
      title: title.trim(),
      description: description.trim(),
      creatorEmail: creatorEmail.trim(),
      fundingGoalXlm: parsedGoal,
      durationDays: parsedDays,
      category,
      hasRevenueSharing,
      revenueSharePercentage: hasRevenueSharing ? revenueSharePercentage : 0,
      estimatedDeadlineTimestamp: Math.floor(Date.now() / 1000) + parsedDays * 86400,
      tags,
      coverImageUrl: coverImageUrl.trim(),
    });
    setIsReviewOpen(true);
  };

  // Resolve a key to a translated string (or undefined)
  const err = (key: keyof FormErrorKeys) =>
    errorKeys[key] ? t(errorKeys[key] as Parameters<typeof t>[0]) : undefined;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-linear-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
      <main className="container mx-auto px-4 py-10 max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-1">
            {t('pageTitle')}
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm">{t('pageSubtitle')}</p>
        </div>

        {/* Wallet guard banner */}
        {!isWalletConnected && (
          <div className="mb-6 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-5 flex items-center justify-between gap-4">
            <p className="text-amber-800 dark:text-amber-300 text-sm font-medium">
              {t('walletGuard')}
            </p>
            <button
              type="button"
              onClick={connectWallet}
              disabled={walletLoading}
              className="shrink-0 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {walletLoading ? t('connecting') : t('connectWallet')}
            </button>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6 space-y-6"
        >
          {/* Title */}
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
            >
              {t('labelTitle')} <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              aria-invalid={Boolean(errorKeys.title)}
              aria-describedby={errorKeys.title ? 'title-error' : undefined}
              placeholder={t('placeholderTitle')}
              className={`w-full px-3 py-2 rounded-lg border text-sm bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                errorKeys.title
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-zinc-200 dark:border-zinc-600'
              }`}
            />
            <div className="flex justify-between mt-1">
              {err('title') ? (
                <p id="title-error" className="text-xs text-red-500">
                  {err('title')}
                </p>
              ) : (
                <span />
              )}
              <span className="text-xs text-zinc-400 ml-auto">{title.length}/100</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
            >
              {t('labelDescription')} <span className="text-red-500">*</span>
            </label>
            <div className="border border-zinc-200 dark:border-zinc-600 rounded-lg overflow-hidden">
              <div className="flex border-b border-zinc-200 dark:border-zinc-600">
                <button
                  type="button"
                  onClick={() => setDescriptionTab('write')}
                  className={`px-4 py-2 text-sm font-medium ${
                    descriptionTab === 'write'
                      ? 'bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50'
                      : 'bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                  }`}
                >
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setDescriptionTab('preview')}
                  className={`px-4 py-2 text-sm font-medium ${
                    descriptionTab === 'preview'
                      ? 'bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50'
                      : 'bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                  }`}
                >
                  Preview
                </button>
              </div>
              {descriptionTab === 'write' ? (
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={1000}
                  rows={5}
                  aria-invalid={Boolean(errorKeys.description)}
                  aria-describedby={errorKeys.description ? 'description-error' : undefined}
                  placeholder={t('placeholderDescription')}
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none resize-y"
                />
              ) : (
                <div className="px-3 py-2 min-h-[120px] bg-zinc-50 dark:bg-zinc-700 text-sm text-zinc-600 dark:text-zinc-400">
                  {description.trim() ? (
                    <div className="prose prose-zinc dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                        {description}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <span className="italic text-zinc-400">Nothing to preview</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-between mt-1">
              {err('description') ? (
                <p id="description-error" className="text-xs text-red-500">
                  {err('description')}
                </p>
              ) : (
                <span />
              )}
              <span className="text-xs text-zinc-400 ml-auto">{description.length}/1,000</span>
            </div>
          </div>

          {/* Optional creator email (off-chain only) */}
          <div>
            <label
              htmlFor="creatorEmail"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
            >
              {t('labelCreatorEmailOptional')}
            </label>
            <input
              id="creatorEmail"
              type="email"
              value={creatorEmail}
              onChange={(e) => setCreatorEmail(e.target.value)}
              aria-invalid={Boolean(errorKeys.creatorEmail)}
              aria-describedby={errorKeys.creatorEmail ? 'creator-email-error' : 'creator-email-note'}
              placeholder={t('placeholderCreatorEmail')}
              className={`w-full px-3 py-2 rounded-lg border text-sm bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                errorKeys.creatorEmail
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-zinc-200 dark:border-zinc-600'
              }`}
            />
            {err('creatorEmail') ? (
              <p id="creator-email-error" className="text-xs text-red-500 mt-1">
                {err('creatorEmail')}
              </p>
            ) : (
              <p id="creator-email-note" className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {t('creatorEmailNote')}
              </p>
            )}
          </div>

          {/* Funding Goal + Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Funding Goal */}
            <div>
              <label
                htmlFor="fundingGoal"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                {t('labelFundingGoal')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs font-semibold select-none">
                  XLM
                </span>
                <input
                  id="fundingGoal"
                  type="number"
                  value={fundingGoal}
                  onChange={(e) => setFundingGoal(e.target.value)}
                  min="0.0000001"
                  step="any"
                  aria-invalid={Boolean(errorKeys.fundingGoal)}
                  aria-describedby={errorKeys.fundingGoal ? 'funding-goal-error' : undefined}
                  placeholder="e.g. 1000"
                  className={`w-full pl-12 pr-3 py-2 rounded-lg border text-sm bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                    errorKeys.fundingGoal
                      ? 'border-red-400 dark:border-red-500'
                      : 'border-zinc-200 dark:border-zinc-600'
                  }`}
                />
              </div>
              {err('fundingGoal') && (
                <p id="funding-goal-error" className="text-xs text-red-500 mt-1">
                  {err('fundingGoal')}
                </p>
              )}
            </div>

            {/* Duration */}
            <div>
              <label
                htmlFor="durationDays"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                {t('labelDuration')} <span className="text-red-500">*</span>
              </label>
              <input
                id="durationDays"
                type="number"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                min="1"
                max="365"
                step="1"
                aria-invalid={Boolean(errorKeys.durationDays)}
                aria-describedby={errorKeys.durationDays ? 'duration-days-error' : undefined}
                placeholder={t('placeholderDuration')}
                className={`w-full px-3 py-2 rounded-lg border text-sm bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                  errorKeys.durationDays
                    ? 'border-red-400 dark:border-red-500'
                    : 'border-zinc-200 dark:border-zinc-600'
                }`}
              />
              {err('durationDays') && (
                <p id="duration-days-error" className="text-xs text-red-500 mt-1">
                  {err('durationDays')}
                </p>
              )}
            </div>
          </div>

          {/* Category */}
          <div>
            <label
              htmlFor="category"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
            >
              {t('labelCategory')} <span className="text-red-500">*</span>
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => handleCategoryChange(Number(e.target.value) as Category)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 text-sm bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
            {category === Category.EducationalStartup && (
              <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                {t('startupRevenueHint')}
              </p>
            )}
          </div>

          {/* Revenue Sharing */}
          {isStartup && (
            <div className="rounded-xl border border-blue-100 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {t('revenueSharingTitle')}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {t('revenueSharingDesc')}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-label={t('revenueSharingAriaLabel')}
                  aria-checked={hasRevenueSharing}
                  onClick={() => setHasRevenueSharing((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    hasRevenueSharing ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      hasRevenueSharing ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {hasRevenueSharing && (
                // #110 — slider now models percent directly (0.5 % steps) so
                // round percentages are easy to hit. A companion bps input lets
                // users enter exact values when they need them. Submitted value
                // is still converted to bps at submit time.
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="revenueShareSlider"
                      className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      {t('labelRevenueSharePct')}
                    </label>
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 tabular-nums" title={`Stored on-chain as ${Math.round(revenueSharePercentage * 100)} basis points`}>
                      {revenueSharePercentage.toFixed(2)}%
                    </span>
                  </div>

                  {/* Slider — operates in percent, 0.5 % steps (#110) */}
                  <input
                    id="revenueShareSlider"
                    type="range"
                    min="0.5"
                    max="50"
                    step="0.5"
                    value={revenueSharePercentage}
                    onChange={(e) =>
                      setRevenueSharePercentage(parseFloat(e.target.value))
                    }
                    aria-label={t('labelRevenueSharePct')}
                    className="w-full h-2 rounded-full accent-blue-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-zinc-400 mt-1">
                    <span>0.5%</span>
                    <span>50%</span>
                  </div>

                  {/* Precise bps input for exact values (#110) */}
                  <div className="flex items-center gap-2 mt-2">
                    <label
                      htmlFor="revenueShareBps"
                      className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0"
                    >
                      Exact bps:
                    </label>
                    <input
                      id="revenueShareBps"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="5000"
                      step="1"
                      value={Math.round(revenueSharePercentage * 100)}
                      onChange={(e) => {
                        const bps = parseInt(e.target.value, 10);
                        if (!isNaN(bps) && bps >= 1 && bps <= 5000) {
                          setRevenueSharePercentage(bps / 100);
                        }
                      }}
                      className="w-24 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                    <span className="text-xs text-zinc-400">/ 10 000</span>
                  </div>

                  {err('revenueSharePercentage') && (
                    <p className="text-xs text-red-500 mt-1">{err('revenueSharePercentage')}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('labelTags')} <span className="text-xs font-normal text-zinc-400">({t('tagsLimitTip')})</span>
            </label>
            <div className={`flex flex-wrap gap-2 p-2 rounded-lg border bg-zinc-50 dark:bg-zinc-700 transition-colors ${tags.length >= 3 ? 'border-zinc-200 dark:border-zinc-600' : 'border-zinc-200 dark:border-zinc-600 focus-within:ring-2 focus-within:ring-blue-500'}`}>
              {tags.map((tag: string, idx: number) => (
                <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-200 dark:border-blue-800 transition-all">
                  #{tag}
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter((_: string, i: number) => i !== idx))}
                    className="hover:text-blue-900 dark:hover:text-blue-100 transition-colors"
                  >
                    ✕
                  </button>
                </span>
              ))}
              {tags.length < 3 && (
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTagInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      const val = tagInput.trim();
                      if (val && !tags.includes(val)) {
                        setTags([...tags, val]);
                        setTagInput('');
                      }
                    }
                  }}
                  placeholder={tags.length === 0 ? t('placeholderTags') : ''}
                  className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 min-w-[120px]"
                />
              )}
            </div>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
              {t('tagsHelpText')}
            </p>
          </div>

          {/* Cover Image URL */}
          <div>
            <label
              htmlFor="coverImageUrl"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
            >
              Cover Image URL <span className="text-xs font-normal text-zinc-400">(optional)</span>
            </label>
            <input
              id="coverImageUrl"
              type="url"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="https://ipfs.io/ipfs/... or https://i.imgur.com/..."
              aria-invalid={Boolean(errorKeys.coverImageUrl)}
              aria-describedby={errorKeys.coverImageUrl ? 'cover-image-error' : undefined}
              className={`w-full px-3 py-2 rounded-lg border text-sm bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                errorKeys.coverImageUrl
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-zinc-200 dark:border-zinc-600'
              }`}
            />
            {errorKeys.coverImageUrl && (
              <p id="cover-image-error" className="text-xs text-red-500 mt-1">
                Please enter a valid URL (must start with http:// or https://).
              </p>
            )}
            {coverImageUrl && !errorKeys.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverImageUrl}
                alt="Cover preview"
                className="mt-2 w-full aspect-video object-cover rounded-lg border border-zinc-200 dark:border-zinc-600"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => router.push('/causes')}
              className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isWalletConnected}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t('launchCampaign')}
            </button>
          </div>
        </form>

        {isReviewOpen && reviewData && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-review-title"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isSubmitting) {
                setIsReviewOpen(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !isSubmitting) {
                setIsReviewOpen(false);
              }
            }}
          >
            <div className="w-full max-w-xl rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
              <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-700">
                <h2
                  id="campaign-review-title"
                  className="text-xl font-semibold text-zinc-900 dark:text-zinc-50"
                >
                  {t('reviewTitle')}
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                  {t('reviewSubtitle')}
                </p>
              </div>

              <dl className="px-6 py-5 space-y-4">
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-3">
                  <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {t('reviewFieldTitle')}
                  </dt>
                  <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mt-1">
                    {reviewData.title}
                  </dd>
                </div>

                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-3">
                  <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {t('reviewFieldCreatorEmail')}
                  </dt>
                  <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mt-1">
                    {reviewData.creatorEmail || t('reviewCreatorEmailNone')}
                  </dd>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-3">
                    <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {t('reviewFieldFundingGoal')}
                    </dt>
                    <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mt-1">
                      {reviewData.fundingGoalXlm.toLocaleString(undefined, {
                        maximumFractionDigits: 7,
                      })}{' '}
                      XLM
                    </dd>
                  </div>

                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-3">
                    <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {t('reviewFieldDuration')}
                    </dt>
                    <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mt-1">
                      {t('reviewFieldDurationDays', { count: reviewData.durationDays })}
                    </dd>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-3">
                    <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {t('reviewFieldCategory')}
                    </dt>
                    <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mt-1">
                      {CATEGORY_LABELS[reviewData.category]}
                    </dd>
                  </div>

                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-3">
                    <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {t('reviewFieldRevenueShare')}
                    </dt>
                    <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mt-1">
                      {reviewData.hasRevenueSharing
                        ? `${reviewData.revenueSharePercentage.toFixed(2)}%`
                        : t('reviewRevenueShareNone')}
                    </dd>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-3">
                  <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {t('reviewFieldEndDate')}
                  </dt>
                  <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mt-1">
                    {formatReviewDate(reviewData.estimatedDeadlineTimestamp)}
                  </dd>
                </div>

                {reviewData.tags.length > 0 && (
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-3">
                    <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {t('reviewFieldTags')}
                    </dt>
                    <dd className="flex flex-wrap gap-2 mt-1.5">
                      {reviewData.tags.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold border border-zinc-300 dark:border-zinc-600">
                          #{tag}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}

                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-3">
                  <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {t('reviewFieldTimestamp')}
                  </dt>
                  <dd className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-1 tabular-nums">
                    {reviewData.estimatedDeadlineTimestamp}
                  </dd>
                </div>
              </dl>

              <div className="px-6 py-5 border-t border-zinc-200 dark:border-zinc-700 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsReviewOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('editDetails')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAndSign}
                  disabled={isSubmitting || !isWalletConnected}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting && (
                    <span className="inline-block motion-safe:animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  )}
                  {isSubmitting ? t('submitting') : t('confirmAndSign')}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
