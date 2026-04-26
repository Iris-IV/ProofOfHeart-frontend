"use client";
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getAddress, isConnected, isAllowed } from "@stellar/freighter-api";
import { useToast } from "./ToastProvider";

interface WalletContextType {
  publicKey: string | null;
  isWalletConnected: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  isLoading: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { showError, showWarning, showSuccess } = useToast();

  useEffect(() => {
    // Restore session from localStorage
    const storedKey = localStorage.getItem("stellar_wallet_public_key");
    if (storedKey) {
      setPublicKey(storedKey);
      setIsWalletConnected(true);
    } else {
      checkWalletConnection();
    }
  }, []);

  const checkWalletConnection = async () => {
    try {
      const connected = await isConnected();
      const allowed = await isAllowed();
      if (connected && allowed) {
        const key = await getAddress();
        setPublicKey(key.address);
        setIsWalletConnected(true);
        localStorage.setItem("stellar_wallet_public_key", key.address);
      }
    } catch {
      // Not connected
    }
  };

  const connectWallet = async () => {
    setIsLoading(true);
    try {
      const connected = await isConnected();
      if (!connected) {
        showWarning("Freighter wallet not found. Opening install page…");
        window.open("https://www.freighter.app/", "_blank");
        setIsLoading(false);
        return;
      }
      const allowed = await isAllowed();
      if (!allowed) {
        showWarning("Please allow Freighter to connect to this site.");
        setIsLoading(false);
        return;
      }
      const key = await getAddress();
      setPublicKey(key.address);
      setIsWalletConnected(true);
      localStorage.setItem("stellar_wallet_public_key", key.address);
      showSuccess("Wallet connected successfully.");
    } catch {
      showError("Failed to connect wallet. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = () => {
    setPublicKey(null);
    setIsWalletConnected(false);
    localStorage.removeItem("stellar_wallet_public_key");
  };

  return (
    <WalletContext.Provider
      value={{ publicKey, isWalletConnected, connectWallet, disconnectWallet, isLoading }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
};
