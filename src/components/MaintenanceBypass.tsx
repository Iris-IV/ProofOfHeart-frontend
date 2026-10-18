"use client";
import { useEffect } from "react";
import { useWallet } from "@/components/WalletContext";
import { MAINTENANCE_COOKIE, BYPASS_COOKIE_MAX_AGE } from "@/middleware";

const ALLOWLIST = (process.env.NEXT_PUBLIC_MAINTENANCE_ALLOWLIST ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export default function MaintenanceBypass() {
  const { publicKey } = useWallet();

  useEffect(() => {
    if (!publicKey) return;
    if (ALLOWLIST.includes(publicKey.toLowerCase())) {
      document.cookie = `${MAINTENANCE_COOKIE}=${publicKey.toLowerCase()}; path=/; max-age=${BYPASS_COOKIE_MAX_AGE}; SameSite=Lax`;
    }
  }, [publicKey]);

  return null;
}
