'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAddress, isConnected, isAllowed } from '@stellar/freighter-api';
import { useToast } from './ToastProvider';
import { formatAddress } from '@/lib/formatAddress';

interface WalletConnectionProps {
  onWalletConnected: (publicKey: string) => void;
  onWalletDisconnected: () => void;
}

export default function WalletConnection({ onWalletConnected, onWalletDisconnected }: WalletConnectionProps) {
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { showError, showWarning, showSuccess } = useToast();

  const checkWalletConnection = useCallback(async () => {
    try {
      const connectedResponse = await isConnected();
      const allowedResponse = await isAllowed();

      if (connectedResponse.isConnected && allowedResponse.isAllowed) {
        const key = await getAddress();
        setPublicKey(key.address);
        setIsWalletConnected(true);
        onWalletConnected(key.address);
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
    }
  }, [onWalletConnected]);

  useEffect(() => {
    checkWalletConnection();
  }, [checkWalletConnection]);

  const connectWallet = async () => {
    setIsLoading(true);
    try {
      const connectedResponse = await isConnected();
      if (!connectedResponse.isConnected) {
        showWarning('Freighter wallet not found. Opening install page…');
        window.open('https://www.freighter.app/', '_blank');
        setIsLoading(false);
        return;
      }

      const allowedResponse = await isAllowed();
      if (!allowedResponse.isAllowed) {
        showWarning('Please allow Freighter to connect to this site.');
        setIsLoading(false);
        return;
      }

      const key = await getAddress();
      setPublicKey(key.address);
      setIsWalletConnected(true);
      onWalletConnected(key.address);
      showSuccess('Wallet connected successfully.');
    } catch (error) {
      console.error('Error connecting wallet:', error);
      showError('Failed to connect wallet. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = () => {
    setPublicKey(null);
    setIsWalletConnected(false);
    onWalletDisconnected();
  };


  return (
    <div className="flex items-center gap-4">
      {!isWalletConnected ? (
        <button
          onClick={connectWallet}
          disabled={isLoading}
          className="px-4 py-2 bg-linear-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold rounded-full transition-all duration-200 transform hover:motion-safe:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Connecting...' : 'Connect Wallet'}
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <div className="px-3 py-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm font-medium">
            {formatAddress(publicKey!)}
          </div>
          <button
            onClick={disconnectWallet}
            className="px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}