"use client";

import { Contrast } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui";

export default function ContrastToggle({ className }: { className?: string }) {
  const t = useTranslations("Common");
  const { highContrast, setHighContrast } = useTheme();
  return (
    <Button
      variant="secondary"
      size="sm"
      aria-pressed={Boolean(highContrast)}
      onClick={() => setHighContrast(!highContrast)}
      className={`duration-[120ms] motion-reduce:transition-none ${className ?? ""}`}
    >
      <Contrast size={18} aria-hidden="true" />
      {t("highContrast")}
    </Button>
  );
}
