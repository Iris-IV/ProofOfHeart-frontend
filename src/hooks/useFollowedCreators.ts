import { useState, useEffect } from "react";
import { useWallet } from "@/components/WalletContext";

const STORAGE_KEY_PREFIX = "poh_followed_creators_";

export function useFollowedCreators() {
  const { publicKey } = useWallet();
  const [followedAddresses, setFollowedAddresses] = useState<string[]>([]);

  useEffect(() => {
    if (!publicKey) {
      setFollowedAddresses([]);
      return;
    }
    const key = `${STORAGE_KEY_PREFIX}${publicKey}`;
    try {
      const data = localStorage.getItem(key);
      setFollowedAddresses(data ? JSON.parse(data) : []);
    } catch {
      setFollowedAddresses([]);
    }
  }, [publicKey]);

  const toggleFollow = (creatorAddress: string) => {
    if (!publicKey) return;

    setFollowedAddresses((prev) => {
      const next = prev.includes(creatorAddress)
        ? prev.filter((a) => a !== creatorAddress)
        : [...prev, creatorAddress];
      try {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${publicKey}`, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const isFollowing = (creatorAddress: string) => followedAddresses.includes(creatorAddress);

  return { followedAddresses, toggleFollow, isFollowing };
}
