"use client";
import * as StellarSdk from "@stellar/stellar-sdk";
import { getAddress, getNetwork, isConnected, isAllowed } from "@stellar/freighter-api";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  ReactNode,
  useRef,
} from "react";
import { useToast } from "./ToastProvider";
import { useQueryClient } from "@tanstack/react-query";
import { IS_MOCK_MODE } from "@/lib/runtimeEnv";
import { setActiveWalletSigner, type WalletKind } from "@/lib/walletSigner";
import {
  connectSocialWallet,
  disconnectSocialWallet,
  isSocialLoginConfigured,
  restoreSocialWallet,
  socialSigner,
  type SocialLoginProvider,
  type SocialWalletSession,
} from "@/lib/socialWallet";
import { isFreighterLockedError } from "@/utils/freighterErrors";
import InstallFreighterModal from "./InstallFreighterModal";
import SocialLoginButtons from "./SocialLoginButtons";

interface WalletContextType {
  publicKey: string | null;
  isWalletConnected: boolean;
  walletNetworkWarning: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  isLoading: boolean;
  /** Which wallet backs the current session — null when disconnected. */
  walletKind: WalletKind | null;
  /** Profile of the social account, when connected via social login (#649). */
  socialProfile: SocialWalletSession | null;
  /** Whether social login is available (a Web3Auth client id is configured). */
  isSocialLoginAvailable: boolean;
  connectWithSocial: (provider: SocialLoginProvider) => Promise<void>;
}

const MOCK_PUBLIC_KEY = IS_MOCK_MODE ? StellarSdk.Keypair.random().publicKey() : null;

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isFreighterLocked, setIsFreighterLocked] = useState(false);
  const [walletNetworkWarning, setWalletNetworkWarning] = useState<string | null>(null);
  const [walletKind, setWalletKind] = useState<WalletKind | null>(null);
  const [socialProfile, setSocialProfile] = useState<SocialWalletSession | null>(null);
  const { showError, showWarning, showSuccess } = useToast();
  const queryClient = useQueryClient();
  const previousPublicKeyRef = useRef<string | null>(null);
  /** #560 — Tracks whether the install prompt was already surfaced by polling. */
  const installPromptSurfacedRef = useRef(false);
  // #649 — The Freighter poll below runs on a timer and would tear down a social
  // session the moment it saw the extension reporting "not connected". A ref
  // rather than the state value because the poll closes over its first render.
  const isSocialSessionRef = useRef(false);
  const appNetworkPassphrase = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || "";
  const appNetworkLabel = appNetworkPassphrase.includes("Public Global")
    ? "Mainnet"
    : appNetworkPassphrase.includes("Test SDF")
      ? "Testnet"
      : "the app network";

  useEffect(() => {
    if (IS_MOCK_MODE) {
      const storedKey =
        typeof window !== "undefined" ? localStorage.getItem("stellar_wallet_public_key") : null;
      if (storedKey) {
        setPublicKey(storedKey);
        setIsWalletConnected(true);
        setWalletKind("freighter");
        previousPublicKeyRef.current = storedKey;
      }
      setWalletNetworkWarning(null);
      return;
    }

    // #649 — Restore an embedded social wallet before touching Freighter. This
    // never opens a popup; it only rehydrates a session Web3Auth already holds.
    void restoreSocialWallet().then((restored) => {
      if (!restored) return;
      applySocialSession(restored);
    });

    // Always re-verify with Freighter rather than blindly trusting localStorage (#97)
    void checkWalletConnection();

    // WatchWalletChanges only fires on address/network changes, NOT on external
    // disconnection. Use polling instead to detect all state transitions.
    const POLL_INTERVAL_MS = 5000;
    const intervalId = window.setInterval(() => {
      if (!document.hidden) {
        void checkWalletConnection();
      }
    }, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void checkWalletConnection();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // checkWalletConnection is intentionally omitted from deps -- all its
    // transitive deps (state setters, refs, env constant) are stable across
    // renders, so the function identity is effectively stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Adopt a restored or freshly created social session as the active wallet. */
  const applySocialSession = (restored: SocialWalletSession) => {
    isSocialSessionRef.current = true;
    setActiveWalletSigner(socialSigner);
    setPublicKey(restored.publicKey);
    setIsWalletConnected(true);
    setWalletKind("social");
    setSocialProfile(restored);
    // The embedded wallet is derived per Web3Auth network, which is itself pinned
    // to the app network, so a mismatch is not representable here.
    setWalletNetworkWarning(null);
    previousPublicKeyRef.current = restored.publicKey;
  };

  const checkWalletConnection = async () => {
    // A social wallet owns the session; Freighter's state is irrelevant until
    // the user explicitly disconnects.
    if (isSocialSessionRef.current) return;

    if (IS_MOCK_MODE) {
      const storedKey =
        typeof window !== "undefined" ? localStorage.getItem("stellar_wallet_public_key") : null;
      if (storedKey) {
        setPublicKey(storedKey);
        setIsWalletConnected(true);
        setWalletKind("freighter");
        previousPublicKeyRef.current = storedKey;
      } else {
        setPublicKey(null);
        setIsWalletConnected(false);
        setWalletKind(null);
      }
      setWalletNetworkWarning(null);
      return;
    }

    try {
      const { isConnected: connected } = await isConnected();
      const { isAllowed: allowed } = await isAllowed();
      if (connected && allowed) {
        // Freighter is present and authorised — dismiss any lingering install prompt.
        setShowInstallPrompt(false);
        installPromptSurfacedRef.current = false;
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
        setWalletKind("freighter");
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
        setWalletKind(null);
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
      setWalletKind(null);
      localStorage.removeItem("stellar_wallet_public_key");
      // Invalidate queries on error
      if (previousPublicKeyRef.current !== null) {
        invalidateWalletQueries();
        previousPublicKeyRef.current = null;
      }

      // #560 — the Freighter API throws when the extension is not installed.
      // Surface the install prompt so the user gets a clear CTA instead of
      // silently staying disconnected. A ref (not state) guards against
      // redundant checks because checkWalletConnection is stable-closured.
      if (!isSocialSessionRef.current && !installPromptSurfacedRef.current) {
        void isFreighterInstalled().then((installed) => {
          if (!installed) {
            installPromptSurfacedRef.current = true;
            setShowInstallPrompt(true);
          }
        });
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

  const isFreighterInstalled = async (): Promise<boolean> => {
    try {
      const result = await isConnected();
      return result.isConnected;
    } catch {
      return false;
    }
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
        setWalletKind("freighter");
        setWalletNetworkWarning(null);
        localStorage.setItem("stellar_wallet_public_key", mockAddress);
        previousPublicKeyRef.current = mockAddress;
        showSuccess("Mock wallet connected successfully.");
        return;
      }

      const installed = await isFreighterInstalled();
      if (!installed) {
        setShowInstallPrompt(true);
        setIsLoading(false);
        return;
      }
      const { isAllowed: allowed } = await isAllowed();
      if (!allowed) {
        showWarning("Please allow Freighter to connect to this site.");
        setIsLoading(false);
        return;
      }
      const key = await getAddress();
      if (key.error && isFreighterLockedError(key.error)) {
        setIsFreighterLocked(true);
        setShowInstallPrompt(true);
        setIsLoading(false);
        return;
      }
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
      // Connecting Freighter supersedes any social session, so hand the signer back.
      isSocialSessionRef.current = false;
      setActiveWalletSigner(null);
      setSocialProfile(null);
      setPublicKey(key.address);
      setIsWalletConnected(true);
      setWalletKind("freighter");
      localStorage.setItem("stellar_wallet_public_key", key.address);
      showSuccess("Wallet connected successfully.");
    } catch (error) {
      setPublicKey(null);
      setIsWalletConnected(false);
      setWalletKind(null);
      setWalletNetworkWarning(null);
      if (isFreighterLockedError(error)) {
        setIsFreighterLocked(true);
        setShowInstallPrompt(true);
      } else {
        showError("Failed to connect wallet. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * #649 — Create or restore an embedded wallet from a Google or X account, so
   * visitors without a browser extension can still contribute.
   */
  const connectWithSocial = async (provider: SocialLoginProvider) => {
    if (!isSocialLoginConfigured()) {
      showError("Social login is not available right now.");
      return;
    }

    setIsLoading(true);
    try {
      const newSession = await connectSocialWallet(provider);
      applySocialSession(newSession);
      // Nothing wallet-scoped was fetched for this address yet; refresh so the
      // dashboard and balances reflect the newly connected account.
      invalidateWalletQueries();
      showSuccess(
        `Signed in with ${provider === "twitter" ? "X" : "Google"}. Your wallet is ready.`,
      );
    } catch (error) {
      // A closed popup is a deliberate user action, not a failure worth an error toast.
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("closed") || message.includes("cancel")) {
        showWarning("Sign-in cancelled.");
      } else {
        showError("Could not complete social sign-in. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryInstall = async () => {
    setShowInstallPrompt(false);
    setIsFreighterLocked(false);
    await connectWallet();
  };

  const disconnectWallet = () => {
    const wasSocial = isSocialSessionRef.current;

    setPublicKey(null);
    setIsWalletConnected(false);
    setWalletKind(null);
    setWalletNetworkWarning(null);
    setSocialProfile(null);
    localStorage.removeItem("stellar_wallet_public_key");
    // Invalidate wallet-scoped queries on disconnect
    invalidateWalletQueries();
    previousPublicKeyRef.current = null;

    if (wasSocial) {
      // Drop the in-memory signing key first so nothing can sign while the
      // remote logout is still in flight.
      isSocialSessionRef.current = false;
      setActiveWalletSigner(null);
      void disconnectSocialWallet();
      showSuccess("Signed out. Your wallet key was cleared from this device.");
      return;
    }

    // Freighter has no programmatic revoke API. Inform the user how to fully sever access.
    showWarning(
      "Disconnected. To fully revoke Freighter access, open the extension and remove this site from Connected Sites.",
    );
  };

  const contextValue = useMemo(
    () => ({
      publicKey,
      isWalletConnected,
      walletNetworkWarning,
      connectWallet,
      disconnectWallet,
      isLoading,
      walletKind,
      socialProfile,
      isSocialLoginAvailable: isSocialLoginConfigured(),
      connectWithSocial,
    }),
    [
      publicKey,
      isWalletConnected,
      walletNetworkWarning,
      isLoading,
      walletKind,
      socialProfile,
      connectWithSocial,
    ],
  );

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
      <InstallFreighterModal
        isOpen={showInstallPrompt}
        onClose={() => {
          setShowInstallPrompt(false);
          setIsFreighterLocked(false);
        }}
        onRetry={handleRetryInstall}
        isLocked={isFreighterLocked}
        socialLogin={
          isSocialLoginConfigured() ? (
            <SocialLoginButtons
              available
              disabled={isLoading}
              onSelect={connectWithSocial}
              onConnected={() => setShowInstallPrompt(false)}
            />
          ) : undefined
        }
      />
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
};
