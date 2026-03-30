'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Category, CATEGORY_LABELS, xlmToStroops } from '../../types';
import { createCampaign } from '../../lib/contractClient';
import { useWallet } from '../../components/WalletContext';
import { useToast } from '../../components/ToastProvider';
import { parseContractError } from '../../utils/contractErrors';
import { Spinner } from '../../components/Skeleton';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface FormValues {
    title: string;
    description: string;
    fundingGoal: string;
    durationDays: string;
    category: string;
    hasRevenueSharing: boolean;
    revenueSharePct: string;
    mediaUrl: string;
}

interface FormErrors {
    title?: string;
    description?: string;
    fundingGoal?: string;
    durationDays?: string;
    category?: string;
    revenueSharePct?: string;
    mediaUrl?: string;
}

function validate(values: FormValues): FormErrors {
    const errors: FormErrors = {};

    if (!values.title.trim()) {
        errors.title = 'Title is required.';
    } else if (values.title.trim().length < 10) {
        errors.title = 'Title must be at least 10 characters.';
    } else if (values.title.trim().length > 100) {
        errors.title = 'Title must be 100 characters or fewer.';
    }

    if (!values.description.trim()) {
        errors.description = 'Description is required.';
    } else if (values.description.trim().length < 50) {
        errors.description = 'Description must be at least 50 characters.';
    } else if (values.description.trim().length > 2000) {
        errors.description = 'Description must be 2000 characters or fewer.';
    }

    const goal = parseFloat(values.fundingGoal);
    if (!values.fundingGoal || isNaN(goal) || goal <= 0) {
        errors.fundingGoal = 'Funding goal must be a positive number.';
    } else if (goal > 10_000_000) {
        errors.fundingGoal = 'Funding goal cannot exceed 10,000,000 XLM.';
    }

    const days = parseInt(values.durationDays, 10);
    if (!values.durationDays || isNaN(days) || days < 1) {
        errors.durationDays = 'Duration must be at least 1 day.';
    } else if (days > 365) {
        errors.durationDays = 'Duration cannot exceed 365 days.';
    }

    if (values.category === '') {
        errors.category = 'Please select a category.';
    }

    if (values.hasRevenueSharing) {
        const pct = parseFloat(values.revenueSharePct);
        if (!values.revenueSharePct || isNaN(pct) || pct <= 0) {
            errors.revenueSharePct = 'Revenue share percentage must be positive.';
        } else if (pct > 100) {
            errors.revenueSharePct = 'Revenue share cannot exceed 100%.';
        }
    }

    if (values.mediaUrl && values.mediaUrl.trim()) {
        try {
            new URL(values.mediaUrl.trim());
        } catch {
            errors.mediaUrl = 'Please enter a valid URL.';
        }
    }

    return errors;
}

// ---------------------------------------------------------------------------
// Field components
// ---------------------------------------------------------------------------

function FieldError({ msg }: { msg?: string }) {
    if (!msg) return null;
    return <p className="mt-1 text-xs text-red-500 dark:text-red-400">{msg}</p>;
}

function Label({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
    return (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            {children}
            {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
    );
}

const inputCls = (hasError: boolean) =>
    `w-full px-4 py-3 rounded-xl border text-zinc-900 dark:text-zinc-50 bg-white dark:bg-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 transition ${hasError
        ? 'border-red-400 dark:border-red-500 focus:ring-red-400'
        : 'border-zinc-300 dark:border-zinc-600 focus:ring-blue-500'
    }`;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const INITIAL: FormValues = {
    title: '',
    description: '',
    fundingGoal: '',
    durationDays: '30',
    category: '',
    hasRevenueSharing: false,
    revenueSharePct: '',
    mediaUrl: '',
};

export default function SubmitCausePage() {
    const router = useRouter();
    const { publicKey, isWalletConnected, connectWallet } = useWallet();
    const { showSuccess, showError } = useToast();

    const [values, setValues] = useState<FormValues>(INITIAL);
    const [errors, setErrors] = useState<FormErrors>({});
    const [touched, setTouched] = useState<Partial<Record<keyof FormValues, boolean>>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);

    const set = (field: keyof FormValues, value: string | boolean) => {
        setValues((v) => ({ ...v, [field]: value }));
        if (touched[field]) {
            setErrors((e) => ({ ...e, ...validate({ ...values, [field]: value }) }));
        }
    };

    const blur = (field: keyof FormValues) => {
        setTouched((t) => ({ ...t, [field]: true }));
        setErrors((e) => ({ ...e, ...validate(values) }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const allTouched = Object.keys(INITIAL).reduce(
            (acc, k) => ({ ...acc, [k]: true }),
            {} as Record<keyof FormValues, boolean>
        );
        setTouched(allTouched);
        const errs = validate(values);
        setErrors(errs);
        if (Object.keys(errs).length > 0) return;
        if (!publicKey) return;

        setIsSubmitting(true);
        try {
            const goal = xlmToStroops(parseFloat(values.fundingGoal));
            const days = parseInt(values.durationDays, 10);
            const cat = parseInt(values.category, 10) as Category;
            const revShareBps = values.hasRevenueSharing
                ? Math.round(parseFloat(values.revenueSharePct) * 100)
                : 0;

            const hash = await createCampaign(
                publicKey,
                values.title.trim(),
                values.description.trim(),
                goal,
                days,
                cat,
                values.hasRevenueSharing,
                revShareBps,
            );

            setTxHash(hash);
            showSuccess('Cause submitted successfully! It will appear once confirmed on-chain.');
        } catch (err) {
            showError(parseContractError(err));
        } finally {
            setIsSubmitting(false);
        }
    };

    // -------------------------------------------------------------------------
    // Success screen
    // -------------------------------------------------------------------------

    if (txHash) {
        const explorerBase = process.env.NEXT_PUBLIC_EXPLORER_URL ?? 'https://stellar.expert/explorer/testnet/tx';
        return (
            <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center px-4">
                <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-700 p-8 max-w-md w-full text-center space-y-5">
                    <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-3xl mx-auto">✓</div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Cause Submitted!</h1>
                    <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                        Your cause has been submitted to the Stellar network. Once confirmed, it will be visible to the community for validation.
                    </p>
                    <a
                        href={`${explorerBase}/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:text-blue-800 dark:hover:text-blue-200 transition-colors break-all"
                    >
                        View transaction on Stellar Explorer →
                    </a>
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <Link
                            href="/causes"
                            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm text-center transition-colors"
                        >
                            Browse Causes
                        </Link>
                        <button
                            onClick={() => { setValues(INITIAL); setTouched({}); setErrors({}); setTxHash(null); }}
                            className="flex-1 py-3 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium rounded-xl text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                        >
                            Submit Another
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // -------------------------------------------------------------------------
    // Wallet gate
    // -------------------------------------------------------------------------

    if (!isWalletConnected) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center px-4">
                <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-700 p-8 max-w-sm w-full text-center space-y-4">
                    <div className="text-4xl">🔗</div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Connect your wallet</h2>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        You need a connected Freighter wallet to submit a cause.
                    </p>
                    <button
                        onClick={connectWallet}
                        className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold rounded-xl transition-all"
                    >
                        Connect Wallet
                    </button>
                    <Link href="/causes" className="block text-sm text-zinc-500 dark:text-zinc-400 hover:underline">
                        ← Back to causes
                    </Link>
                </div>
            </div>
        );
    }

    // -------------------------------------------------------------------------
    // Form
    // -------------------------------------------------------------------------

    const descLen = values.description.length;
    const titleLen = values.title.length;
    const isEducationalStartup = parseInt(values.category, 10) === Category.EducationalStartup;

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
            <main className="container mx-auto px-4 py-8 max-w-2xl">
                {/* Breadcrumb */}
                <nav className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-2 mb-6">
                    <Link href="/causes" className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
                        Causes
                    </Link>
                    <span>›</span>
                    <span className="text-zinc-900 dark:text-zinc-50">Submit a Cause</span>
                </nav>

                <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 sm:p-8">
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-1">Submit a Cause</h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
                        Fill in the details below. Your cause will be submitted on-chain and opened for community validation.
                    </p>

                    <form onSubmit={handleSubmit} noValidate className="space-y-6">

                        {/* Title */}
                        <div>
                            <Label htmlFor="title" required>Title</Label>
                            <input
                                id="title"
                                type="text"
                                value={values.title}
                                onChange={(e) => set('title', e.target.value)}
                                onBlur={() => blur('title')}
                                placeholder="A clear, compelling name for your cause"
                                maxLength={100}
                                className={inputCls(!!touched.title && !!errors.title)}
                            />
                            <div className="flex justify-between mt-1">
                                <FieldError msg={touched.title ? errors.title : undefined} />
                                <span className={`text-xs ml-auto ${titleLen > 90 ? 'text-amber-500' : 'text-zinc-400'}`}>
                                    {titleLen}/100
                                </span>
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <Label htmlFor="description" required>Description</Label>
                            <textarea
                                id="description"
                                rows={5}
                                value={values.description}
                                onChange={(e) => set('description', e.target.value)}
                                onBlur={() => blur('description')}
                                placeholder="Describe your cause, its goals, and why the community should support it. Minimum 50 characters."
                                maxLength={2000}
                                className={`${inputCls(!!touched.description && !!errors.description)} resize-y min-h-[120px]`}
                            />
                            <div className="flex justify-between mt-1">
                                <FieldError msg={touched.description ? errors.description : undefined} />
                                <span className={`text-xs ml-auto ${descLen > 1800 ? 'text-amber-500' : 'text-zinc-400'}`}>
                                    {descLen}/2000
                                </span>
                            </div>
                        </div>

                        {/* Category */}
                        <div>
                            <Label htmlFor="category" required>Category</Label>
                            <select
                                id="category"
                                value={values.category}
                                onChange={(e) => { set('category', e.target.value); if (parseInt(e.target.value, 10) !== Category.EducationalStartup) set('hasRevenueSharing', false); }}
                                onBlur={() => blur('category')}
                                className={inputCls(!!touched.category && !!errors.category)}
                            >
                                <option value="">Select a category…</option>
                                {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                                    <option key={val} value={val}>{label}</option>
                                ))}
                            </select>
                            <FieldError msg={touched.category ? errors.category : undefined} />
                            {values.category !== '' && (
                                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                    {parseInt(values.category, 10) === Category.Learner && 'For individual learners seeking educational support.'}
                                    {parseInt(values.category, 10) === Category.EducationalStartup && 'For startups building educational products. Revenue sharing available.'}
                                    {parseInt(values.category, 10) === Category.Educator && 'For teachers and educators creating learning resources.'}
                                    {parseInt(values.category, 10) === Category.Publisher && 'For publishers producing educational content.'}
                                </p>
                            )}
                        </div>

                        {/* Funding goal + duration — side by side on sm+ */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="fundingGoal" required>Funding Goal (XLM)</Label>
                                <div className="relative">
                                    <input
                                        id="fundingGoal"
                                        type="number"
                                        min="1"
                                        step="any"
                                        value={values.fundingGoal}
                                        onChange={(e) => set('fundingGoal', e.target.value)}
                                        onBlur={() => blur('fundingGoal')}
                                        placeholder="e.g. 5000"
                                        className={`${inputCls(!!touched.fundingGoal && !!errors.fundingGoal)} pr-14`}
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-zinc-400 pointer-events-none">
                                        XLM
                                    </span>
                                </div>
                                <FieldError msg={touched.fundingGoal ? errors.fundingGoal : undefined} />
                            </div>

                            <div>
                                <Label htmlFor="durationDays" required>Duration (days)</Label>
                                <input
                                    id="durationDays"
                                    type="number"
                                    min="1"
                                    max="365"
                                    step="1"
                                    value={values.durationDays}
                                    onChange={(e) => set('durationDays', e.target.value)}
                                    onBlur={() => blur('durationDays')}
                                    placeholder="30"
                                    className={inputCls(!!touched.durationDays && !!errors.durationDays)}
                                />
                                <FieldError msg={touched.durationDays ? errors.durationDays : undefined} />
                                {values.durationDays && !errors.durationDays && (
                                    <p className="mt-1 text-xs text-zinc-400">
                                        Ends {new Date(Date.now() + parseInt(values.durationDays, 10) * 86400_000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Revenue sharing — only for Educational Startup */}
                        {isEducationalStartup && (
                            <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 p-4 space-y-3">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        id="hasRevenueSharing"
                                        checked={values.hasRevenueSharing}
                                        onChange={(e) => set('hasRevenueSharing', e.target.checked)}
                                        className="mt-0.5 w-4 h-4 rounded border-zinc-300 text-purple-600 focus:ring-purple-500"
                                    />
                                    <div>
                                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Enable revenue sharing</span>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                            Contributors receive a share of future revenue proportional to their contribution.
                                        </p>
                                    </div>
                                </label>

                                {values.hasRevenueSharing && (
                                    <div>
                                        <Label htmlFor="revenueSharePct" required>Revenue share percentage</Label>
                                        <div className="relative">
                                            <input
                                                id="revenueSharePct"
                                                type="number"
                                                min="0.01"
                                                max="100"
                                                step="0.01"
                                                value={values.revenueSharePct}
                                                onChange={(e) => set('revenueSharePct', e.target.value)}
                                                onBlur={() => blur('revenueSharePct')}
                                                placeholder="e.g. 5"
                                                className={`${inputCls(!!touched.revenueSharePct && !!errors.revenueSharePct)} pr-8`}
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-zinc-400 pointer-events-none">%</span>
                                        </div>
                                        <FieldError msg={touched.revenueSharePct ? errors.revenueSharePct : undefined} />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Supporting media URL */}
                        <div>
                            <Label htmlFor="mediaUrl">Supporting media URL (optional)</Label>
                            <input
                                id="mediaUrl"
                                type="url"
                                value={values.mediaUrl}
                                onChange={(e) => set('mediaUrl', e.target.value)}
                                onBlur={() => blur('mediaUrl')}
                                placeholder="https://example.com/image-or-video"
                                className={inputCls(!!touched.mediaUrl && !!errors.mediaUrl)}
                            />
                            <FieldError msg={touched.mediaUrl ? errors.mediaUrl : undefined} />
                            <p className="mt-1 text-xs text-zinc-400">
                                Link to an image, video, or document that supports your cause. Stored off-chain.
                            </p>
                        </div>

                        {/* Summary preview */}
                        {values.title && values.fundingGoal && values.durationDays && values.category !== '' && (
                            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-700/40 border border-zinc-200 dark:border-zinc-600 p-4 space-y-1 text-sm">
                                <p className="font-medium text-zinc-700 dark:text-zinc-300">Preview</p>
                                <p className="text-zinc-900 dark:text-zinc-50 font-semibold">{values.title}</p>
                                <p className="text-zinc-500 dark:text-zinc-400">
                                    {CATEGORY_LABELS[parseInt(values.category, 10) as Category]} · {values.fundingGoal} XLM goal · {values.durationDays} days
                                    {values.hasRevenueSharing && ` · ${values.revenueSharePct}% revenue share`}
                                </p>
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-4 min-h-[52px] bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-base"
                        >
                            {isSubmitting ? (
                                <>
                                    <Spinner className="h-5 w-5" />
                                    Submitting to Stellar…
                                </>
                            ) : (
                                'Submit Cause'
                            )}
                        </button>

                        <p className="text-xs text-center text-zinc-400 dark:text-zinc-500">
                            Submitting will open Freighter to sign the transaction. A small network fee applies.
                        </p>
                    </form>
                </div>
            </main>
        </div>
    );
}
