"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock3, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { getEmergencyWithdrawal } from "@/lib/contractClient";

function countdown(target: number, now: number): string {
  const seconds = Math.max(0, target - now);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

export default function EmergencyWithdrawalBanner({ campaignId }: { campaignId: number }) {
  const t = useTranslations("CauseDetail");
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const { data: pending } = useQuery({
    queryKey: ["emergency-withdrawal", campaignId],
    queryFn: () => getEmergencyWithdrawal(campaignId, true),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(interval);
  }, []);

  if (!pending) return null;

  const remaining = Math.max(0, pending.executeAfter - now);
  return (
    <aside
      className="my-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
      role="status"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
        <div>
          <h2 className="font-semibold">{t("emergencyWithdrawalPendingTitle")}</h2>
          <p className="mt-1 text-sm">{t("emergencyWithdrawalPendingDescription")}</p>
          <p className="mt-2 break-all font-mono text-xs">
            {t("emergencyWithdrawalRecipient", { address: pending.recipient })}
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm" aria-live="polite">
            <Clock3 size={16} aria-hidden="true" />
            {remaining > 0
              ? t("emergencyWithdrawalCountdown", {
                  remaining: countdown(pending.executeAfter, now),
                })
              : t("emergencyWithdrawalReady")}
          </p>
        </div>
      </div>
    </aside>
  );
}
