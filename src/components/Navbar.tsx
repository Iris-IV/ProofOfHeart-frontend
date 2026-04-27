"use client";

import { Menu, X, Moon, Sun, ShieldCheck, Plus } from "lucide-react";
import Image from "next/image";
import { useTranslations } from 'next-intl';
import { useState, useEffect, useRef } from "react";
import { useWallet } from "@/components/WalletContext";
import { useTheme } from "@/hooks/useTheme";
import { Link } from '@/i18n/routing';
import { getAdmin } from "@/lib/contractClient";
import { formatAddress } from "@/lib/formatAddress";
import LanguageSwitcher from "./LanguageSwitcher";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useMemo } from "react";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuToggleButtonRef = useRef<HTMLButtonElement>(null);
  const { publicKey, isWalletConnected, connectWallet, disconnectWallet, isLoading } = useWallet();
  const { theme, toggleTheme } = useTheme();
  const t = useTranslations('Common');
  const [adminAddress, setAdminAddress] = useState<string | null>(null);

  const { campaigns } = useCampaigns();
  const pendingCount = useMemo(() => {
    return campaigns.filter(c => !c.is_verified && c.is_active && !c.is_cancelled).length;
  }, [campaigns]);

  const networkPassphrase = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || '';
  const isTestnet = networkPassphrase.includes('Test SDF');
  const isMainnet = networkPassphrase.includes('Public Global');

  useEffect(() => {
    getAdmin().then(setAdminAddress).catch(() => { });
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const menuElement = menuRef.current;
    if (!menuElement) {
      return;
    }

    const focusableElements = menuElement.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    firstFocusable?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        menuToggleButtonRef.current?.focus();
        return;
      }

      if (event.key !== "Tab" || focusableElements.length === 0) {
        return;
      }

      const activeElement = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable?.focus();
        }
      } else if (activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const isAdmin = isWalletConnected && publicKey === adminAddress;

  const navLinks = [
    { href: "/", label: t('home') },
    { href: "/causes", label: t('explore') },
    { href: "/about", label: t('about') },
  ];

  if (isAdmin) {
    navLinks.push({ href: "/admin", label: t('admin') });
  }


  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/80 transition-all duration-300">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md py-1 font-semibold tracking-tight text-zinc-950 hover:opacity-90 dark:text-zinc-50 transition-opacity"
        >
          <Image
            src="/proof-of-heart-logo.svg"
            alt="ProofOfHeart Logo"
            width={140}
            height={42}
            className="h-8 w-auto filter dark:invert"
            priority
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-2 md:flex" aria-label="Primary">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href as Parameters<typeof Link>[0]['href']}
              className="relative rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-black/5 hover:text-zinc-950 dark:text-zinc-200 dark:hover:bg-white/10 dark:hover:text-white transition-all group"
            >
              <span className="flex items-center gap-1.5">
                {link.href === '/admin' && <ShieldCheck size={14} className="text-blue-500" />}
                {link.label}
                {link.href === '/admin' && pendingCount > 0 && (
                  <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white animate-in zoom-in duration-300">
                    {pendingCount}
                  </span>
                )}
              </span>
              <span className="absolute bottom-1 left-4 right-4 h-0.5 bg-blue-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {isTestnet && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800 uppercase tracking-wider">
              Testnet
            </span>
          )}
          {isMainnet && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400 border border-green-200 dark:border-green-800 uppercase tracking-wider">
              Mainnet
            </span>
          )}
          <div className="hidden sm:block border-r border-zinc-200 dark:border-zinc-800 h-6 mx-1" />
          <LanguageSwitcher />

          <button
            onClick={toggleTheme}
            className="flex size-9 items-center justify-center rounded-full border border-black/10 bg-white text-zinc-950 hover:bg-black/5 dark:border-white/15 dark:bg-zinc-800 dark:text-white dark:hover:bg-white/10 transition-colors shadow-sm"
            aria-label="Toggle theme"
            aria-pressed={theme === 'dark'}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          <div className="hidden md:flex items-center gap-2 ml-2">
            {!isWalletConnected ? (
              <button
                type="button"
                onClick={connectWallet}
                disabled={isLoading}
                className="h-10 items-center justify-center rounded-full bg-linear-to-r from-red-500 to-pink-500 px-6 text-sm font-bold text-white transition-all hover:motion-safe:scale-105 hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-red-500/20"
              >
                {isLoading ? t('connecting') : t('connectWallet')}
              </button>
            ) : (
              <div className="flex items-center gap-3 pl-2">
                <Link
                  href="/causes/new"
                  className="inline-flex items-center gap-1.5 h-9 px-3 lg:px-4 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20"
                  title={t('createCampaign')}
                >
                  <Plus size={14} />
                  <span className="hidden lg:inline">{t('createCampaign')}</span>
                </Link>
                <div className="flex flex-col items-end">
                  <span className="hidden lg:block text-[10px] uppercase tracking-wider font-bold text-zinc-400 dark:text-zinc-500 leading-none mb-1">
                    Connected
                  </span>
                  <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-mono font-bold border border-blue-100 dark:border-blue-800">
                    {formatAddress(publicKey!)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={disconnectWallet}
                  className="size-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all border border-transparent hover:border-red-100 dark:hover:border-red-900/30"
                  title={t('disconnect')}
                  aria-label={t('disconnect')}
                >
                  <X size={18} />
                </button>
              </div>
            )}
          </div>

          <button
            ref={menuToggleButtonRef}
            type="button"
            aria-controls="mobile-menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
            className="inline-flex size-10 items-center justify-center rounded-lg border border-black/10 bg-white text-zinc-950 hover:bg-black/5 dark:border-white/15 dark:bg-zinc-900 dark:text-white dark:hover:bg-white/10 md:hidden transition-colors shadow-sm"
          >
            <span className="sr-only">Toggle menu</span>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div ref={menuRef} id="mobile-menu" className="border-t border-black/5 dark:border-white/10 md:hidden bg-white dark:bg-zinc-900 motion-safe:animate-in motion-safe:slide-in-from-top duration-300">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
            <nav aria-label="Mobile">
              <ul className="flex flex-col gap-2">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href as Parameters<typeof Link>[0]['href']}
                      onClick={() => setMenuOpen(false)}
                      className={`block rounded-xl px-4 py-3 text-base font-semibold transition-all ${link.href === '/admin'
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                        : 'text-zinc-800 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10'
                        }`}
                    >
                      <span className="flex items-center gap-2">
                        {link.href === '/admin' && <ShieldCheck size={18} />}
                        {link.label}
                        {link.href === '/admin' && pendingCount > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                            {pendingCount}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

              {isWalletConnected && (
                <Link
                  href="/causes/new"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-center gap-2 h-12 w-full rounded-xl bg-blue-600 text-white text-base font-bold hover:bg-blue-700 transition-colors"
                >
                  <Plus size={18} />
                  {t('createCampaign')}
                </Link>
              )}

              {!isWalletConnected ? (
                <button
                  type="button"
                  onClick={connectWallet}
                  disabled={isLoading}
                  className="h-12 w-full rounded-xl bg-linear-to-r from-red-500 to-pink-500 px-4 text-base font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                >
                  {isLoading ? t('connecting') : t('connectWallet')}
                </button>
              ) : (
                <div className="flex flex-col gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Account</span>
                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 rounded text-[10px] font-bold">Connected</span>
                  </div>
                  <span className="text-sm font-mono font-bold text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-center">
                    {publicKey}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      disconnectWallet();
                      setMenuOpen(false);
                    }}
                    className="w-full py-2.5 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors border border-red-100 dark:border-red-900/30"
                  >
                    {t('disconnect')}
                  </button>
                </div>
              )}
            </div>
        </div>
      )}
    </header>
  );
}
