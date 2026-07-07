"use client";
import * as StellarSdk from "@stellar/stellar-sdk";
import { getNetwork } from "@stellar/freighter-api";
import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { useToast } from "./ToastProvider";
import { useQueryClient } from "@tanstack/react-query";
import { IS_MOCK_MODE } from "@/lib/runtimeEnv";
import { getAdapter, ALL_ADAPTERS } from "@/lib/walletAdapters";
import type { WalletId } from "@/lib/walletAdapters";
import WalletSelectModal from "./WalletSelectModal";

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------

interface WalletContextType {
  publicKey: string | null;
  isWalletConnected: boolean;
  walletNetworkWarning: string | null;
  /** ID of the currently active wallet adapter, or null if not connected. */
  activeWalletId: WalletId | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  isLoading: boolean;
  /**
   * Signs a Stellar transaction XDR using the active wallet adapter.
   *
   * @param xdr               Base64-encoded transaction envelope XDR.
   * @param networkPassphrase Stellar network passphrase.
   * @returns Signed XDR string.
   * @throws if no wallet is connected or the user rejects the signature.
   */
  signTransaction: (xdr: string, networkPassphrase: string) => Promise<string>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WALLET_ID_STORAGE_KEY = "stellar_wallet_id";
const PUBLIC_KEY_STORAGE_KEY = "stellar_wallet_public_key";

const MOCK_PUBLIC_KEY = IS_MOCK_MODE ? StellarSdk.Keypair.random().publicKey() : null;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [walletNetworkWarning, setWalletNetworkWarning] = useState<string | null>(null);
  const [activeWalletId, setActiveWalletId] = useState<WalletId | null>(null);

  // Modal state
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [connectingId, setConnectingId] = useState<WalletId | null>(null);

  const { showError, showWarning, showSuccess } = useToast();
  const queryClient = useQueryClient();
  const previousPublicKeyRef = useRef<string | null>(null);

  const appNetworkPassphrase = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? "";
  const appNetworkLabel = appNetworkPassphrase.includes("Public Global")
    ? "Mainnet"
    : appNetworkPassphrase.includes("Test SDF")
      ? "Testnet"
      : "the app network";

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  const invalidateWalletQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    queryClient.invalidateQueries({ queryKey: ["contributions"] });
    queryClient.invalidateQueries({ queryKey: ["revenue"] });
    queryClient.invalidateQueries({ queryKey: ["stellarBalance"] });
  };

  const clearWalletState = () => {
    setPublicKey(null);
    setIsWalletConnected(false);
    setActiveWalletId(null);
    setWalletNetworkWarning(null);
    localStorage.removeItem(PUBLIC_KEY_STORAGE_KEY);
    localStorage.removeItem(WALLET_ID_STORAGE_KEY);
  };

  /** Check the Freighter network and warn if mismatched. Returns false on mismatch. */
  const checkFreighterNetwork = async (): Promise<boolean> => {
    try {
      const network = await getNetwork();
      const walletPassphrase = network.networkPassphrase ?? "";
      if (walletPassphrase !== appNetworkPassphrase) {
        setWalletNetworkWarning(
          `Switch your wallet to ${appNetworkLabel} to continue. Current wallet network does not match the app network.`,
        );
        return false;
      }
    } catch {
      // If we can't read the network, don't block — just warn.
    }
    setWalletNetworkWarning(null);
    return true;
  };

  // -------------------------------------------------------------------------
  // Silent restore on mount
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (IS_MOCK_MODE) {
      const storedKey = typeof window !== "undefined"
        ? localStorage.getItem(PUBLIC_KEY_STORAGE_KEY)
        : null;
      if (storedKey) {
        setPublicKey(storedKey);
        setIsWalletConnected(true);
        previousPublicKeyRef.current = storedKey;
      }
      return;
    }

    void silentRestore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * On page load, try to silently restore the previously chosen wallet
   * session without showing any prompts.
   */
  const silentRestore = async () => {
    if (typeof window === "undefined") return;

    const savedWalletId = localStorage.getItem(WALLET_ID_STORAGE_KEY) as WalletId | null;
    if (!savedWalletId) return;

    // Validate saved ID against known adapters
    const knownIds = ALL_ADAPTERS.map((a) => a.id);
    if (!knownIds.includes(savedWalletId)) return;

    try {
      const adapter = getAdapter(savedWalletId);
      if (!adapter.isAvailable()) return;

      const connected = await adapter.isConnected();
      if (!connected) return;

      const key = await adapter.getPublicKey();
      if (!key) return;

      // Network check for Freighter only (other wallets handle it internally)
      if (savedWalletId === "freighter") {
        const ok = await checkFreighterNetwork();
        if (!ok) {
          clearWalletState();
          return;
        }
      }

      setActiveWalletId(savedWalletId);
      setPublicKey(key);
      setIsWalletConnected(true);
      localStorage.setItem(PUBLIC_KEY_STORAGE_KEY, key);
      previousPublicKeyRef.current = key;
    } catch {
      // Silent restore failed — start disconnected.
      clearWalletState();
    }
  };

  // -------------------------------------------------------------------------
  // connectWallet — opens the wallet selection modal
  // -------------------------------------------------------------------------

  const connectWallet = async () => {
    if (IS_MOCK_MODE) {
      setIsLoading(true);
      try {
        const mockAddress = MOCK_PUBLIC_KEY;
        if (!mockAddress) throw new Error("Mock wallet initialization failed.");
        setPublicKey(mockAddress);
        setIsWalletConnected(true);
        setActiveWalletId("freighter"); // Mock always uses freighter id
        setWalletNetworkWarning(null);
        localStorage.setItem(PUBLIC_KEY_STORAGE_KEY, mockAddress);
        localStorage.setItem(WALLET_ID_STORAGE_KEY, "freighter");
        previousPublicKeyRef.current = mockAddress;
        showSuccess("Mock wallet connected successfully.");
      } catch {
        showError("Failed to connect wallet. Please try again.");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Show the wallet selection modal
    setShowSelectModal(true);
  };

  // -------------------------------------------------------------------------
  // handleWalletSelected — called when the user picks a wallet in the modal
  // -------------------------------------------------------------------------

  const handleWalletSelected = async (id: WalletId) => {
    setConnectingId(id);
    setIsLoading(true);
    try {
      const adapter = getAdapter(id);

      if (!adapter.isAvailable()) {
        // Not installed; modal shows the install link — shouldn't reach here
        // for unavailable wallets, but guard anyway.
        window.open(adapter.installUrl, "_blank");
        return;
      }

      const key = await adapter.connect();

      // Network check for Freighter
      if (id === "freighter") {
        const ok = await checkFreighterNetwork();
        if (!ok) {
          showWarning(
            `Switch your wallet to ${appNetworkLabel} to continue. Current wallet network does not match the app network.`,
          );
          return;
        }
      }

      setActiveWalletId(id);
      setPublicKey(key);
      setIsWalletConnected(true);
      setWalletNetworkWarning(null);
      localStorage.setItem(PUBLIC_KEY_STORAGE_KEY, key);
      localStorage.setItem(WALLET_ID_STORAGE_KEY, id);

      if (
        previousPublicKeyRef.current !== null &&
        previousPublicKeyRef.current !== key
      ) {
        invalidateWalletQueries();
      }
      previousPublicKeyRef.current = key;

      setShowSelectModal(false);
      showSuccess("Wallet connected successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      showError(`Failed to connect wallet: ${message}`);
    } finally {
      setConnectingId(null);
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // signTransaction
  // -------------------------------------------------------------------------

  const signTransaction = async (xdr: string, networkPassphrase: string): Promise<string> => {
    if (!activeWalletId) {
      throw new Error("No wallet connected. Please connect a wallet first.");
    }
    const adapter = getAdapter(activeWalletId);
    return adapter.signTransaction(xdr, networkPassphrase);
  };

  // -------------------------------------------------------------------------
  // disconnectWallet
  // -------------------------------------------------------------------------

  const disconnectWallet = () => {
    clearWalletState();
    invalidateWalletQueries();
    previousPublicKeyRef.current = null;
    showWarning(
      "Disconnected. To fully revoke wallet access, open the extension and remove this site from its connected sites.",
    );
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <WalletContext.Provider
      value={{
        publicKey,
        isWalletConnected,
        walletNetworkWarning,
        activeWalletId,
        connectWallet,
        disconnectWallet,
        isLoading,
        signTransaction,
      }}
    >
      {children}
      <WalletSelectModal
        isOpen={showSelectModal}
        isLoading={isLoading}
        connectingId={connectingId}
        onSelect={handleWalletSelected}
        onClose={() => {
          if (!isLoading) setShowSelectModal(false);
        }}
      />
    </WalletContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
};
