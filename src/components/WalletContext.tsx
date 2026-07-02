"use client";
import * as StellarSdk from "@stellar/stellar-sdk";
import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { useToast } from "./ToastProvider";
import { useQueryClient } from "@tanstack/react-query";
import { IS_MOCK_MODE } from "@/lib/runtimeEnv";
import {
  type WalletAdapter,
  type WalletId,
  WALLET_ADAPTERS,
  MockAdapter,
} from "@/lib/walletAdapters";
import { setActiveWalletAdapter } from "@/lib/contractClient";
import WalletSelectionModal from "./WalletSelectionModal";

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------

interface WalletContextType {
  publicKey: string | null;
  isWalletConnected: boolean;
  walletNetworkWarning: string | null;
  /** The id of the currently active wallet adapter, or null if not connected. */
  activeWalletId: WalletId | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOCK_PUBLIC_KEY = IS_MOCK_MODE ? StellarSdk.Keypair.random().publicKey() : null;
const ACTIVE_WALLET_KEY = "stellar_active_wallet";
const WALLET_PUBLIC_KEY = "stellar_wallet_public_key";

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
  const [showSelectionModal, setShowSelectionModal] = useState(false);

  const { showError, showWarning, showSuccess } = useToast();
  const queryClient = useQueryClient();
  const previousPublicKeyRef = useRef<string | null>(null);

  const appNetworkPassphrase = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? "";
  const appNetworkLabel = appNetworkPassphrase.includes("Public Global")
    ? "Mainnet"
    : appNetworkPassphrase.includes("Test SDF")
      ? "Testnet"
      : "the app network";

  // ── helpers ────────────────────────────────────────────────────────────────

  const getActiveAdapter = (): WalletAdapter | null => {
    if (activeWalletId === "mock") return MOCK_PUBLIC_KEY ? new MockAdapter(MOCK_PUBLIC_KEY) : null;
    return WALLET_ADAPTERS.find((a) => a.id === activeWalletId) ?? null;
  };

  const invalidateWalletQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    queryClient.invalidateQueries({ queryKey: ["contributions"] });
    queryClient.invalidateQueries({ queryKey: ["revenue"] });
    queryClient.invalidateQueries({ queryKey: ["stellarBalance"] });
  };

  // ── network-check helper (Freighter only, other wallets don't expose getNetwork) ──

  const verifyNetwork = async (adapter: WalletAdapter): Promise<boolean> => {
    // Only Freighter exposes a getNetwork API we can call independently
    if (adapter.id !== "freighter") return true;
    try {
      const { getNetwork } = await import("@stellar/freighter-api");
      const network = await getNetwork();
      const walletPassphrase = network.networkPassphrase ?? "";
      if (walletPassphrase !== appNetworkPassphrase) {
        setPublicKey(null);
        setIsWalletConnected(false);
        setWalletNetworkWarning(
          `Switch Freighter to ${appNetworkLabel} to continue. Current wallet network does not match the app network.`,
        );
        localStorage.removeItem(WALLET_PUBLIC_KEY);
        invalidateWalletQueries();
        return false;
      }
    } catch {
      // If we can't check the network, proceed anyway
    }
    return true;
  };

  // ── check / restore existing connection on mount ───────────────────────────

  const checkWalletConnection = async (adapter: WalletAdapter) => {
    if (IS_MOCK_MODE) {
      const storedKey =
        typeof window !== "undefined" ? localStorage.getItem(WALLET_PUBLIC_KEY) : null;
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
      const available = await adapter.isAvailable();
      if (!available) {
        setPublicKey(null);
        setIsWalletConnected(false);
        localStorage.removeItem(WALLET_PUBLIC_KEY);
        if (previousPublicKeyRef.current !== null) {
          invalidateWalletQueries();
          previousPublicKeyRef.current = null;
        }
        return;
      }

      const networkOk = await verifyNetwork(adapter);
      if (!networkOk) return;

      setWalletNetworkWarning(null);
      const newPublicKey = await adapter.getAddress();

      setPublicKey(newPublicKey);
      setIsWalletConnected(true);
      localStorage.setItem(WALLET_PUBLIC_KEY, newPublicKey);

      if (previousPublicKeyRef.current !== null && previousPublicKeyRef.current !== newPublicKey) {
        invalidateWalletQueries();
      }
      previousPublicKeyRef.current = newPublicKey;
    } catch {
      setWalletNetworkWarning(null);
      setPublicKey(null);
      setIsWalletConnected(false);
      localStorage.removeItem(WALLET_PUBLIC_KEY);
      if (previousPublicKeyRef.current !== null) {
        invalidateWalletQueries();
        previousPublicKeyRef.current = null;
      }
    }
  };

  // ── on mount: restore the previously used wallet ───────────────────────────

  useEffect(() => {
    if (IS_MOCK_MODE) {
      const storedKey =
        typeof window !== "undefined" ? localStorage.getItem(WALLET_PUBLIC_KEY) : null;
      if (storedKey) {
        setPublicKey(storedKey);
        setIsWalletConnected(true);
        setActiveWalletId("mock");
        previousPublicKeyRef.current = storedKey;
      }
      setWalletNetworkWarning(null);
      return;
    }

    const storedWalletId =
      typeof window !== "undefined"
        ? (localStorage.getItem(ACTIVE_WALLET_KEY) as WalletId | null)
        : null;

    if (!storedWalletId) return;

    const adapter = WALLET_ADAPTERS.find((a) => a.id === storedWalletId);
    if (!adapter) return;

    setActiveWalletId(storedWalletId);
    void checkWalletConnection(adapter);

    adapter.watchChanges(() => void checkWalletConnection(adapter));

    return () => {
      adapter.stopWatching();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── connect: show wallet selection modal ──────────────────────────────────

  const connectWallet = async () => {
    if (IS_MOCK_MODE) {
      setIsLoading(true);
      try {
        const mockAddress = MOCK_PUBLIC_KEY;
        if (!mockAddress) throw new Error("Mock wallet initialization failed.");
        setPublicKey(mockAddress);
        setIsWalletConnected(true);
        setActiveWalletId("mock");
        setWalletNetworkWarning(null);
        localStorage.setItem(WALLET_PUBLIC_KEY, mockAddress);
        localStorage.setItem(ACTIVE_WALLET_KEY, "mock");
        previousPublicKeyRef.current = mockAddress;
        setActiveWalletAdapter(new MockAdapter(mockAddress));
        showSuccess("Mock wallet connected successfully.");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Show the wallet picker — actual connection happens in handleAdapterSelected
    setShowSelectionModal(true);
  };

  // ── called when the user picks a wallet in the modal ──────────────────────

  const handleAdapterSelected = async (walletId: WalletId) => {
    setShowSelectionModal(false);
    const adapter = WALLET_ADAPTERS.find((a) => a.id === walletId);
    if (!adapter) return;

    setIsLoading(true);
    try {
      const available = await adapter.isAvailable();
      if (!available) {
        // Shouldn't reach here (modal opens install page), but guard anyway
        showWarning(`${adapter.name} extension not found. Please install it and try again.`);
        return;
      }

      // Freighter-specific: check if allowed before fetching address
      if (adapter.id === "freighter") {
        const { isAllowed } = await import("@stellar/freighter-api");
        const allowed = await isAllowed();
        if (!allowed) {
          showWarning("Please allow Freighter to connect to this site.");
          return;
        }
      }

      const networkOk = await verifyNetwork(adapter);
      if (!networkOk) {
        showWarning(
          `Switch ${adapter.name} to ${appNetworkLabel} to continue. Current wallet network does not match the app network.`,
        );
        return;
      }

      const address = await adapter.getAddress();
      if (!address) {
        showWarning(`${adapter.name} did not return a public key.`);
        return;
      }

      setPublicKey(address);
      setIsWalletConnected(true);
      setActiveWalletId(walletId);
      setWalletNetworkWarning(null);
      localStorage.setItem(WALLET_PUBLIC_KEY, address);
      localStorage.setItem(ACTIVE_WALLET_KEY, walletId);
      previousPublicKeyRef.current = address;
      setActiveWalletAdapter(adapter);

      // Start watching for account changes
      adapter.watchChanges(() => void checkWalletConnection(adapter));

      showSuccess(`${adapter.name} connected successfully.`);
    } catch {
      setPublicKey(null);
      setIsWalletConnected(false);
      setWalletNetworkWarning(null);
      showError("Failed to connect wallet. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── disconnect ─────────────────────────────────────────────────────────────

  const disconnectWallet = () => {
    const adapter = getActiveAdapter();
    adapter?.stopWatching();

    setPublicKey(null);
    setIsWalletConnected(false);
    setActiveWalletId(null);
    setWalletNetworkWarning(null);
    localStorage.removeItem(WALLET_PUBLIC_KEY);
    localStorage.removeItem(ACTIVE_WALLET_KEY);
    setActiveWalletAdapter(null);
    invalidateWalletQueries();
    previousPublicKeyRef.current = null;

    showWarning(
      "Disconnected. To fully revoke extension access, open the wallet and remove this site from Connected Sites.",
    );
  };

  // ── render ─────────────────────────────────────────────────────────────────

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
      }}
    >
      {children}
      <WalletSelectionModal
        isOpen={showSelectionModal}
        onSelect={handleAdapterSelected}
        onClose={() => setShowSelectionModal(false)}
      />
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
};
