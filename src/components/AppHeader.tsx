'use client';

import Image from 'next/image';
import Link from 'next/link';
import WalletConnection from './WalletConnection';

interface AppHeaderProps {
  onWalletConnected?: (publicKey: string) => void;
  onWalletDisconnected?: () => void;
}

export default function AppHeader({ onWalletConnected, onWalletDisconnected }: AppHeaderProps) {
  return (
    <header className="bg-white dark:bg-zinc-800 shadow-sm border-b border-zinc-200 dark:border-zinc-700">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/proof-of-heart-logo.svg"
              alt="ProofOfHeart"
              width={160}
              height={48}
              className="h-8 w-auto"
            />
          </Link>
          <nav className="hidden sm:flex items-center gap-6 text-sm font-medium">
            <Link
              href="/causes"
              className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
            >
              Browse Causes
            </Link>
          </nav>
          {onWalletConnected && onWalletDisconnected && (
            <WalletConnection
              onWalletConnected={onWalletConnected}
              onWalletDisconnected={onWalletDisconnected}
            />
          )}
        </div>
      </div>
    </header>
  );
}
