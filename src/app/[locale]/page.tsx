'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useWallet } from '@/components/WalletContext';
import { Heart, Shield, Globe, Code, ArrowRight } from "lucide-react";

export default function Home() {
  const t = useTranslations('Home');
  const { isWalletConnected, connectWallet, isLoading } = useWallet();

  return (
    <div className="relative overflow-hidden bg-white dark:bg-zinc-950">
      {/* Background blobs for premium feel */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-red-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob" />
      <div className="absolute top-0 -right-4 w-72 h-72 bg-teal-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000" />

      <main className="relative container mx-auto px-4 py-24 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-bold mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Heart size={16} fill="currentColor" />
            <span>Community Driven Governance</span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-zinc-900 dark:text-zinc-50 mb-8 leading-[1.1] tracking-tight animate-in fade-in slide-in-from-bottom-6 duration-700">
            {t('heroTitle')}
          </h1>

          <p className="text-xl sm:text-2xl text-zinc-600 dark:text-zinc-400 mb-12 leading-relaxed max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {t('heroSubtitle')}
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center animate-in fade-in slide-in-from-bottom-10 duration-1000">
            <Link
              href="/explore"
              className="group flex items-center gap-2 px-10 py-4 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold rounded-2xl transition-all shadow-xl shadow-red-500/25 hover:shadow-red-500/40 hover:-translate-y-1 active:translate-y-0"
            >
              {t('exploreCauses')}
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            {isWalletConnected ? (
              <Link
                href="/causes/new"
                className="px-10 py-4 bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-bold rounded-2xl transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
              >
                {t('startCampaign')}
              </Link>
            ) : (
              <button
                type="button"
                onClick={connectWallet}
                disabled={isLoading}
                className="px-10 py-4 bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-bold rounded-2xl transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Connecting...' : t('startCampaign')}
              </button>
            )}
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-32 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard 
            icon={<Globe className="text-blue-500" />}
            title="Community First"
            description="Causes are validated by the people, not by a corporate board."
            delay="delay-100"
          />
          <FeatureCard 
            icon={<Shield className="text-green-500" />}
            title="Radical Transparency"
            description="Every decision and transaction lives on-chain for anyone to verify."
            delay="delay-200"
          />
          <FeatureCard 
            icon={<ArrowRight className="text-orange-500" />}
            title="Permissionless"
            description="Anyone can propose, support, or challenge a cause."
            delay="delay-300"
          />
          <FeatureCard 
            icon={<Code className="text-purple-500" />}
            title="Trust Through Code"
            description="Smart contracts enforce the rules, removing the need for intermediaries."
            delay="delay-400"
          />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: string }) {
  return (
    <div className={`p-8 rounded-3xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/50 hover:border-blue-200 dark:hover:border-blue-900/30 transition-all hover:shadow-xl hover:shadow-blue-500/5 group animate-in fade-in zoom-in ${delay}`}>
      <div className="w-14 h-14 bg-white dark:bg-zinc-800 rounded-2xl shadow-sm mb-6 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-3">{title}</h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}
