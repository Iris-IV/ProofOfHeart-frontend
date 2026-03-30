"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useWallet } from "@/components/WalletContext";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/causes", label: "Explore Causes" },
  { href: "/about", label: "About" },
];
export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { publicKey, isWalletConnected, connectWallet, disconnectWallet, isLoading } = useWallet();

  const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;
  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-sm dark:border-white/10 dark:bg-zinc-900/80">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md py-1 font-semibold tracking-tight text-zinc-950 hover:opacity-90 dark:text-zinc-50"
        >
          <Image
            src="/proof-of-heart-logo.svg"
            alt="ProofOfHeart Logo"
            width={140}
            height={42}
            className="h-8 w-auto"
            priority
          />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-black/5 hover:text-zinc-950 dark:text-zinc-200 dark:hover:bg-white/10 dark:hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {!isWalletConnected ? (
            <button
              type="button"
              onClick={connectWallet}
              disabled={isLoading}
              className="hidden h-10 items-center justify-center rounded-full bg-linear-to-r from-red-500 to-pink-500 px-5 text-sm font-semibold text-white transition-all hover:from-red-600 hover:to-pink-600 hover:shadow-lg md:inline-flex disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Connecting...' : 'Connect Wallet'}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="px-3 py-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm font-medium">
                {formatAddress(publicKey!)}
              </span>
              <button
                type="button"
                onClick={disconnectWallet}
                className="px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
              >
                Disconnect
              </button>
            </div>
          )}
          {/* TODO: Remove this when we have a better wallet connection solution
          <div className="hidden md:block">
            <WalletConnection onWalletConnected={() => {}} onWalletDisconnected={() => {}} />
          </div>
          */}

          <button
            type="button"
            aria-controls="mobile-menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="inline-flex size-10 items-center justify-center rounded-md border border-black/10 bg-white text-zinc-950 hover:bg-black/5 dark:border-white/15 dark:bg-zinc-900 dark:text-white dark:hover:bg-white/10 md:hidden"
          >
            <span className="sr-only">Toggle menu</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {menuOpen ? (
                <>
                  <path d="M18 6 6 18" />
                  <path d="M6 6l12 12" />
                </>
              ) : (
                <>
                  <path d="M4 6h16" />
                  <path d="M4 12h16" />
                  <path d="M4 18h16" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="mobile-menu" className="border-t border-black/5 dark:border-white/10 md:hidden">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-3 sm:px-6">
            <nav aria-label="Mobile">
              <ul className="flex flex-col gap-1">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-black/5 hover:text-zinc-950 dark:text-zinc-200 dark:hover:bg-white/10 dark:hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {!isWalletConnected ? (
              <button
                type="button"
                onClick={connectWallet}
                disabled={isLoading}
                className="h-10 w-full rounded-full bg-linear-to-r from-red-500 to-pink-500 px-4 text-sm font-semibold text-white transition-all hover:from-red-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Connecting...' : 'Connect Wallet'}
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <span className="px-3 py-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm font-medium text-center">
                  {formatAddress(publicKey!)}
                </span>
                <button
                  type="button"
                  onClick={disconnectWallet}
                  className="px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            )}
            {/* TODO: Remove this when we have a better wallet connection solution
            <div className="mt-2">
              <WalletConnection onWalletConnected={() => {}} onWalletDisconnected={() => {}} />
            </div>
            */} 
          </div>
        </div>
      )}
    </header>
  );
}
