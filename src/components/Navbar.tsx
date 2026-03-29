"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useWallet } from "@/components/WalletContext";
import WalletConnection from "./WalletConnection";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/causes", label: "Explore Causes" },
  { href: "/about", label: "About" },
];
import { useTheme } from "./ThemeProvider";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { publicKey, isWalletConnected, connectWallet, disconnectWallet, isLoading } = useWallet();
  const { theme, toggleTheme } = useTheme();

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
          
          <button
            onClick={toggleTheme}
            className="flex size-10 items-center justify-center rounded-full border border-black/10 bg-white text-zinc-950 hover:bg-black/5 dark:border-white/15 dark:bg-zinc-800 dark:text-white dark:hover:bg-white/10"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21m9.75-9h-2.25M5.25 12H3m16.335-6.835-1.591 1.591M6.835 17.165l-1.591 1.591m11.532-1.591 1.591 1.591M6.835 6.835 5.244 5.244" />
              </svg>
            )}
          </button>

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
            <div className="mt-2">
              <WalletConnection onWalletConnected={() => {}} onWalletDisconnected={() => {}} />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
