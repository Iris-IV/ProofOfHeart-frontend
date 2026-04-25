'use client';

import { useState, useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { useWallet } from '@/components/WalletContext';
import { useToast } from '@/components/ToastProvider';
import { Category, CATEGORY_LABELS, xlmToStroops } from '@/types';
import { createCampaign, getCampaignCount } from '@/lib/contractClient';
import { parseContractError } from '@/utils/contractErrors';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface FormErrors {
  title?: string;
  description?: string;
  fundingGoal?: string;
  durationDays?: string;
  revenueSharePercentage?: string;
}

function validateForm(
  title: string,
  description: string,
  fundingGoal: string,
  durationDays: string,
  hasRevenueSharing: boolean,
  revenueSharePercentage: number,
): FormErrors {
  const errors: FormErrors = {};

  if (title.trim().length < 1) {
    errors.title = 'Title is required.';
  } else if (title.trim().length > 100) {
    errors.title = 'Title must be 100 characters or fewer.';
  }

  if (description.trim().length < 1) {
    errors.description = 'Description is required.';
  } else if (description.trim().length > 1000) {
    errors.description = 'Description must be 1,000 characters or fewer.';
  }

  const goal = parseFloat(fundingGoal);
  if (!fundingGoal || isNaN(goal) || goal <= 0) {
    errors.fundingGoal = 'Funding goal must be greater than 0 XLM.';
  }

  const days = parseInt(durationDays, 10);
  if (!durationDays || isNaN(days) || days < 1 || days > 365) {
    errors.durationDays = 'Duration must be between 1 and 365 days.';
  }

  if (hasRevenueSharing && (revenueSharePercentage < 0.01 || revenueSharePercentage > 50)) {
    errors.revenueSharePercentage = 'Revenue share must be between 0.01% and 50%.';
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateCampaignPage() {
  const router = useRouter();
  const { publicKey, isWalletConnected, connectWallet, isLoading: walletLoading } = useWallet();
  const { showError, showSuccess } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fundingGoal, setFundingGoal] = useState('');
  const [durationDays, setDurationDays] = useState('');
  const [category, setCategory] = useState<Category>(Category.Learner);
  const [hasRevenueSharing, setHasRevenueSharing] = useState(false);
  // slider value in percentage (0.01 – 50), stored as number
  const [revenueSharePercentage, setRevenueSharePercentage] = useState(1);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const DRAFT_KEY = 'proof_of_heart_next_draft';

  // Load draft from local storage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.description) setDescription(parsed.description);
        if (parsed.fundingGoal) setFundingGoal(parsed.fundingGoal);
        if (parsed.durationDays) setDurationDays(parsed.durationDays);
        if (parsed.category !== undefined) setCategory(parsed.category);
        if (parsed.hasRevenueSharing !== undefined) setHasRevenueSharing(parsed.hasRevenueSharing);
        if (parsed.revenueSharePercentage !== undefined) setRevenueSharePercentage(parsed.revenueSharePercentage);
      }
    } catch (e) {
      console.warn('Failed to load draft from localStorage:', e);
    }
  }, []);

  // Save draft to local storage on changes
  useEffect(() => {
    try {
      const draft = {
        title,
        description,
        fundingGoal,
        durationDays,
        category,
        hasRevenueSharing,
        revenueSharePercentage,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {
      console.warn('Failed to save draft to localStorage:', e);
    }
  }, [title, description, fundingGoal, durationDays, category, hasRevenueSharing, revenueSharePercentage]);

  const isStartup = category === Category.EducationalStartup;

  const handleCategoryChange = (val: Category) => {
    setCategory(val);
    if (val !== Category.EducationalStartup) {
      setHasRevenueSharing(false);
      setRevenueSharePercentage(1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isWalletConnected || !publicKey) {
      showError('Please connect your Freighter wallet before creating a campaign.');
      return;
    }

    const formErrors = validateForm(
      title,
      description,
      fundingGoal,
      durationDays,
      hasRevenueSharing,
      revenueSharePercentage,
    );

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const fundingGoalStroops = xlmToStroops(parseFloat(fundingGoal));
      const days = parseInt(durationDays, 10);
      // Convert percentage to basis points: e.g. 5% → 500 bps
      const basisPoints = hasRevenueSharing ? Math.round(revenueSharePercentage * 100) : 0;

      await createCampaign(
        publicKey,
        title.trim(),
        description.trim(),
        fundingGoalStroops,
        days,
        category,
        hasRevenueSharing,
        basisPoints,
      );

      showSuccess('Campaign created successfully!');

      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch (e) {
        // Ignore errors
      }

      // Redirect to the newly created campaign detail page
      try {
        const newId = await getCampaignCount();
        router.push(`/causes/${newId}`);
      } catch {
        router.push('/causes');
      }
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-linear-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
      <main className="container mx-auto px-4 py-10 max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-1">
            Create a Campaign
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm">
            Fill in the details below to launch your campaign on-chain via Freighter.
          </p>
        </div>

        {/* Wallet guard banner */}
        {!isWalletConnected && (
          <div className="mb-6 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-5 flex items-center justify-between gap-4">
            <p className="text-amber-800 dark:text-amber-300 text-sm font-medium">
              Connect your Freighter wallet to create a campaign.
            </p>
            <button
              type="button"
              onClick={connectWallet}
              disabled={walletLoading}
              className="shrink-0 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {walletLoading ? 'Connecting…' : 'Connect Wallet'}
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
              Campaign Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'title-error' : undefined}
              placeholder="A clear, compelling title for your campaign"
              className={`w-full px-3 py-2 rounded-lg border text-sm bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                errors.title
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-zinc-200 dark:border-zinc-600'
              }`}
            />
            <div className="flex justify-between mt-1">
              {errors.title ? (
                <p id="title-error" className="text-xs text-red-500">
                  {errors.title}
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
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={5}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? 'description-error' : undefined}
              placeholder="Describe your campaign, what it aims to achieve, and how funds will be used"
              className={`w-full px-3 py-2 rounded-lg border text-sm bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y transition-colors ${
                errors.description
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-zinc-200 dark:border-zinc-600'
              }`}
            />
            <div className="flex justify-between mt-1">
              {errors.description ? (
                <p id="description-error" className="text-xs text-red-500">
                  {errors.description}
                </p>
              ) : (
                <span />
              )}
              <span className="text-xs text-zinc-400 ml-auto">
                {description.length}/1,000
              </span>
            </div>
          </div>

          {/* Funding Goal + Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Funding Goal */}
            <div>
              <label
                htmlFor="fundingGoal"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Funding Goal (XLM) <span className="text-red-500">*</span>
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
                  aria-invalid={Boolean(errors.fundingGoal)}
                  aria-describedby={errors.fundingGoal ? 'funding-goal-error' : undefined}
                  placeholder="e.g. 1000"
                  className={`w-full pl-12 pr-3 py-2 rounded-lg border text-sm bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                    errors.fundingGoal
                      ? 'border-red-400 dark:border-red-500'
                      : 'border-zinc-200 dark:border-zinc-600'
                  }`}
                />
              </div>
              {errors.fundingGoal && (
                <p id="funding-goal-error" className="text-xs text-red-500 mt-1">
                  {errors.fundingGoal}
                </p>
              )}
            </div>

            {/* Duration */}
            <div>
              <label
                htmlFor="durationDays"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Duration (days) <span className="text-red-500">*</span>
              </label>
              <input
                id="durationDays"
                type="number"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                min="1"
                max="365"
                step="1"
                aria-invalid={Boolean(errors.durationDays)}
                aria-describedby={errors.durationDays ? 'duration-days-error' : undefined}
                placeholder="1–365"
                className={`w-full px-3 py-2 rounded-lg border text-sm bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                  errors.durationDays
                    ? 'border-red-400 dark:border-red-500'
                    : 'border-zinc-200 dark:border-zinc-600'
                }`}
              />
              {errors.durationDays && (
                <p id="duration-days-error" className="text-xs text-red-500 mt-1">
                  {errors.durationDays}
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
              Category <span className="text-red-500">*</span>
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
                Revenue sharing is available for Educational Startup campaigns.
              </p>
            )}
          </div>

          {/* Revenue Sharing — only for Educational Startup */}
          {isStartup && (
            <div className="rounded-xl border border-blue-100 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 space-y-4">
              {/* Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    Revenue Sharing
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Allow contributors to earn a share of future revenue.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-label="Revenue Sharing"
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

              {/* Slider — visible only when revenue sharing is on */}
              {hasRevenueSharing && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="revenueShareSlider"
                      className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Revenue Share Percentage
                    </label>
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                      {revenueSharePercentage.toFixed(2)}%
                      <span className="text-xs text-zinc-400 font-normal ml-1">
                        ({Math.round(revenueSharePercentage * 100)} bps)
                      </span>
                    </span>
                  </div>
                  <input
                    id="revenueShareSlider"
                    type="range"
                    min="1"
                    max="5000"
                    step="1"
                    value={Math.round(revenueSharePercentage * 100)}
                    onChange={(e) =>
                      setRevenueSharePercentage(parseInt(e.target.value, 10) / 100)
                    }
                    className="w-full h-2 rounded-full accent-blue-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-zinc-400 mt-1">
                    <span>0.01%</span>
                    <span>50%</span>
                  </div>
                  {errors.revenueSharePercentage && (
                    <p className="text-xs text-red-500 mt-1">{errors.revenueSharePercentage}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => router.push('/causes')}
              className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isWalletConnected}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting && (
                <span className="inline-block motion-safe:animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              )}
              {isSubmitting ? 'Submitting…' : 'Launch Campaign'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
