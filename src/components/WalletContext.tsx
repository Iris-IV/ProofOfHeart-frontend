"use client";
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  getAddress,
  getNetwork,
  isConnected,
  isAllowed,
  WatchWalletChanges,
} from "@stellar/freighter-api";
import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { useToast } from "./ToastProvider";
import { useQueryClient } from "@tanstack/react-query";
import { IS_MOCK_MODE } from "@/lib/runtimeEnv";

interface WalletContextType {
  publicKey: string | null;
  isWalletConnected: boolean;
  walletNetworkWarning: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  isLoading: boolean;
}

const MOCK_PUBLIC_KEY = IS_MOCK_MODE ? StellarSdk.Keypair.random().publicKey() : null;

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [walletNetworkWarning, setWalletNetworkWarning] = useState<string | null>(null);
  const { showError, showWarning, showSuccess } = useToast();
  const queryClient = useQueryClient();
  const previousPublicKeyRef = useRef<string | null>(null);
  const appNetworkPassphrase = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || "";
  const appNetworkLabel = appNetworkPassphrase.includes("Public Global")
    ? "Mainnet"
    : appNetworkPassphrase.includes("Test SDF")
      ? "Testnet"
      : "the app network";

  useEffect(() => {
    if (IS_MOCK_MODE) {
      const storedKey = typeof window !== "undefined" ? localStorage.getItem("stellar_wallet_public_key") : null;
      if (storedKey) {
        setPublicKey(storedKey);
        setIsWalletConnected(true);
        previousPublicKeyRef.current = storedKey;
      }
      setWalletNetworkWarning(null);
      return;
    }

    // Always re-verify with Freighter rather than blindly trusting localStorage (#97)
    void checkWalletConnection();

    const watcher = new WatchWalletChanges(1000);
    watcher.watch(() => {
      void checkWalletConnection();
    });

    return () => {
      watcher.stop();
    };
  }, []);

  const checkWalletConnection = async () => {
    if (IS_MOCK_MODE) {
      const storedKey = typeof window !== "undefined" ? localStorage.getItem("stellar_wallet_public_key") : null;
      if (storedKey) {
        setPublicKey(storedKey);
        setIsWalletConnected(true);
        previousPublicKeyRef.current = storedKey;
      } else {
        setPublicKey(null);
        setIsWalletConnected(false);
      }
      setWalletNetworkWarning(null);
      return;
    }

    try {
      const connected = await isConnected();
      const allowed = await isAllowed();
      if (connected && allowed) {
        const key = await getAddress();
        const network = await getNetwork();
        const walletNetworkPassphrase = network.networkPassphrase || "";

        if (walletNetworkPassphrase !== appNetworkPassphrase) {
          setPublicKey(null);
          setIsWalletConnected(false);
          setWalletNetworkWarning(
            `Switch Freighter to ${appNetworkLabel} to continue. Current wallet network does not match the app network.`,
          );
          localStorage.removeItem("stellar_wallet_public_key");
          // Invalidate queries on network mismatch
          invalidateWalletQueries();
          return;
        }

        setWalletNetworkWarning(null);
        const newPublicKey = key.address;
        setPublicKey(newPublicKey);
        setIsWalletConnected(true);
        localStorage.setItem("stellar_wallet_public_key", newPublicKey);

        // Detect account change and invalidate wallet-scoped queries
        if (
          previousPublicKeyRef.current !== null &&
          previousPublicKeyRef.current !== newPublicKey
        ) {
          invalidateWalletQueries();
        }
        previousPublicKeyRef.current = newPublicKey;
      } else {
        setWalletNetworkWarning(null);
        setPublicKey(null);
        setIsWalletConnected(false);
        localStorage.removeItem("stellar_wallet_public_key");
        // Invalidate queries when disconnected
        if (previousPublicKeyRef.current !== null) {
          invalidateWalletQueries();
          previousPublicKeyRef.current = null;
        }
      }
    } catch {
      setWalletNetworkWarning(null);
      setPublicKey(null);
      setIsWalletConnected(false);
      localStorage.removeItem("stellar_wallet_public_key");
      // Invalidate queries on error
      if (previousPublicKeyRef.current !== null) {
        invalidateWalletQueries();
        previousPublicKeyRef.current = null;
      }
    }
  };

  // Invalidate all wallet-scoped queries when account/network changes
  const invalidateWalletQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    queryClient.invalidateQueries({ queryKey: ["contributions"] });
    queryClient.invalidateQueries({ queryKey: ["revenue"] });
    queryClient.invalidateQueries({ queryKey: ["stellarBalance"] });
    // Note: campaigns query is not wallet-scoped, so we don't invalidate it
  };

  const connectWallet = async () => {
    setIsLoading(true);
    try {
      if (IS_MOCK_MODE) {
        const mockAddress = MOCK_PUBLIC_KEY;
        if (!mockAddress) {
          throw new Error("Mock wallet initialization failed.");
        }
        setPublicKey(mockAddress);
        setIsWalletConnected(true);
        setWalletNetworkWarning(null);
        localStorage.setItem("stellar_wallet_public_key", mockAddress);
        previousPublicKeyRef.current = mockAddress;
        showSuccess("Mock wallet connected successfully.");
        return;
      }

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
      const network = await getNetwork();
      if ((network.networkPassphrase || "") !== appNetworkPassphrase) {
        const warning = `Switch Freighter to ${appNetworkLabel} to continue. Current wallet network does not match the app network.`;
        setPublicKey(null);
        setIsWalletConnected(false);
        setWalletNetworkWarning(warning);
        showWarning(warning);
        setIsLoading(false);
        return;
      }
      setWalletNetworkWarning(null);
      setPublicKey(key.address);
      setIsWalletConnected(true);
      localStorage.setItem("stellar_wallet_public_key", key.address);
      showSuccess("Wallet connected successfully.");
    } catch {
      setPublicKey(null);
      setIsWalletConnected(false);
      setWalletNetworkWarning(null);
      showError("Failed to connect wallet. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = () => {
    setPublicKey(null);
    setIsWalletConnected(false);
    setWalletNetworkWarning(null);
    localStorage.removeItem("stellar_wallet_public_key");
    // Invalidate wallet-scoped queries on disconnect
    invalidateWalletQueries();
    previousPublicKeyRef.current = null;
    // Freighter has no programmatic revoke API. Inform the user how to fully sever access.
    showWarning(
      "Disconnected. To fully revoke Freighter access, open the extension and remove this site from Connected Sites.",
    );
  };

  return (
    <WalletContext.Provider
      value={{
        publicKey,
        isWalletConnected,
        walletNetworkWarning,
        connectWallet,
        disconnectWallet,
        isLoading,
      }}
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
