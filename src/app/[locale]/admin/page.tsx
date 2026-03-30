'use client';

import { useEffect, useState, useMemo } from 'react';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useWallet } from '@/components/WalletContext';
import { getAdmin, verifyCampaign, cancelCampaign } from '@/lib/contractClient';
import { Campaign, stroopsToXlm, Category, CATEGORY_LABELS } from '@/types';
import { useToast } from '@/components/ToastProvider';
import { CheckCircle, XCircle, ShieldAlert, Loader2, ExternalLink } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

export default function AdminDashboard() {
  const { campaigns, isLoading, refetch } = useCampaigns();
  const { publicKey, isWalletConnected } = useWallet();
  const { showSuccess, showError } = useToast();
  const t = useTranslations('Admin');
  
  const [adminAddress, setAdminAddress] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [isAdminLoading, setIsAdminLoading] = useState(true);

  useEffect(() => {
    getAdmin()
      .then((addr) => setAdminAddress(addr))
      .catch(console.error)
      .finally(() => setIsAdminLoading(false));
  }, []);

  const isAdmin = useMemo(() => {
    if (!publicKey || !adminAddress) return false;
    return publicKey === adminAddress;
  }, [publicKey, adminAddress]);

  const pendingCampaigns = useMemo(() => {
    return campaigns.filter(c => !c.is_verified && c.is_active && !c.is_cancelled);
  }, [campaigns]);

  const handleApprove = async (id: number) => {
    setVerifyingId(id);
    try {
      await verifyCampaign(id);
      showSuccess('Campaign approved and verified successfully!');
      refetch();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to approve campaign');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleReject = async (id: number) => {
    if (!confirm('Are you sure you want to reject (cancel) this campaign?')) return;
    
    setCancellingId(id);
    try {
      await cancelCampaign(id);
      showSuccess('Campaign rejected and cancelled.');
      refetch();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to reject campaign');
    } finally {
      setCancellingId(null);
    }
  };

  if (!isWalletConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <ShieldAlert size={64} className="text-zinc-400 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Wallet Disconnected</h1>
        <p className="text-zinc-600 dark:text-zinc-400 max-w-md">
          Please connect your admin wallet to access the moderation dashboard.
        </p>
      </div>
    );
  }

  if (isAdminLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <p className="text-zinc-600 dark:text-zinc-400">Verifying authorization...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center text-red-600">
        <ShieldAlert size={64} className="mb-4" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-zinc-600 dark:text-zinc-400 max-w-md">
          Your wallet ({publicKey?.slice(0, 8)}...) is not authorized as an administrator.
        </p>
        <Link href="/" className="mt-6 text-blue-600 hover:underline">Return to Home</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            {t('title')}
          </h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            {t('subtitle')}
          </p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg px-4 py-2 text-sm shadow-sm">
          <span className="font-semibold text-blue-700 dark:text-blue-400">Admin: </span>
          <span className="font-mono text-zinc-600 dark:text-zinc-300">{adminAddress?.slice(0, 8)}...{adminAddress?.slice(-8)}</span>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xl shadow-black/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 dark:bg-zinc-800/30 border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest text-zinc-400">{t('cause')}</th>
                <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest text-zinc-400">{t('creator')}</th>
                <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest text-zinc-400">{t('goal')}</th>
                <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest text-zinc-400">{t('category')}</th>
                <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest text-zinc-400 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {pendingCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-zinc-500 italic">
                    <div className="flex flex-col items-center gap-3">
                      <div className="size-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        <CheckCircle className="text-green-500" />
                      </div>
                      <p>{t('noPending')}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                pendingCampaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors group">
                    <td className="px-6 py-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 transition-colors">{campaign.title}</span>
                        <Link 
                          href={`/causes/${campaign.id}`} 
                          className="text-xs text-zinc-500 hover:text-blue-600 flex items-center gap-1 mt-1.5 transition-colors"
                        >
                          View details <ExternalLink size={10} />
                        </Link>
                      </div>
                    </td>
                    <td className="px-6 py-6 font-mono text-xs text-zinc-500">
                      {campaign.creator.slice(0, 6)}...{campaign.creator.slice(-6)}
                    </td>
                    <td className="px-6 py-6">
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">{stroopsToXlm(campaign.funding_goal).toLocaleString()}</span>
                      <span className="ml-1 text-[10px] font-bold text-zinc-400">XLM</span>
                    </td>
                    <td className="px-6 py-6">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                        {CATEGORY_LABELS[campaign.category as Category]}
                      </span>
                    </td>
                    <td className="px-6 py-6 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => handleReject(campaign.id)}
                          disabled={cancellingId === campaign.id || verifyingId === campaign.id}
                          className="size-10 flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all border border-zinc-100 dark:border-zinc-800 hover:border-red-200 dark:hover:border-red-900/40 disabled:opacity-50"
                          title={t('reject')}
                        >
                          {cancellingId === campaign.id ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} />}
                        </button>
                        <button
                          onClick={() => handleApprove(campaign.id)}
                          disabled={verifyingId === campaign.id || cancellingId === campaign.id}
                          className="size-10 flex items-center justify-center text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl transition-all border border-zinc-100 dark:border-zinc-800 hover:border-green-200 dark:hover:border-green-900/40 disabled:opacity-50"
                          title={t('approve')}
                        >
                          {verifyingId === campaign.id ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-10 p-8 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/5 border border-amber-100 dark:border-amber-900/20 rounded-3xl shadow-sm">
        <h3 className="text-base font-bold text-amber-900 dark:text-amber-400 mb-3 flex items-center gap-2">
          <ShieldAlert size={20} /> {t('responsibility')}
        </h3>
        <p className="text-sm text-amber-800/80 dark:text-amber-500/80 leading-relaxed max-w-4xl">
          {t('responsibilityText')}
        </p>
      </div>
    </div>
  );
}
