"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ArrowLeft, Printer, ReceiptText } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  PLACEHOLDER_TAX_ID,
  PLATFORM_NAME,
  downloadTaxReceipt,
  getPlatformTaxId,
  getTaxReceiptFields,
  type TaxReceiptData,
} from "@/lib/taxReceipt";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import { cn } from "./ui/cn";

export interface TaxReceiptPreviewProps {
  data: TaxReceiptData;
  onBack: () => void;
}

/**
 * In-app tax receipt view shown in the donation dialog's success state.
 *
 * It renders the same rows as the printable document (`getTaxReceiptFields`),
 * so what the donor reviews here is exactly what they print. "Print or save as
 * PDF" hands off to `downloadTaxReceipt`, which opens the print-optimised
 * layout. The entrance is a 140ms fade/rise, skipped under reduced motion.
 */
export default function TaxReceiptPreview({ data, onBack }: TaxReceiptPreviewProps) {
  const t = useTranslations("TaxReceipt");
  const prefersReducedMotion = useReducedMotion();
  // Freeze the issue date at first render so the preview matches the print.
  const [issuedAt] = useState(() => new Date());
  const fields = getTaxReceiptFields(data, issuedAt);
  const taxId = getPlatformTaxId();

  return (
    <motion.section
      aria-labelledby="tax-receipt-title"
      data-testid="tax-receipt-preview"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.14, ease: "easeOut" }}
      className="w-full text-left"
    >
      <div className="overflow-hidden rounded-surface border border-white/60 bg-white/70 shadow-xl shadow-accent/10 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/60">
        <header className="bg-linear-to-r from-brand to-accent px-4 py-4 text-white sm:px-6">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 shrink-0" aria-hidden="true" />
            <h3
              id="tax-receipt-title"
              className="text-[clamp(1.05rem,1.5vw+0.8rem,1.35rem)] font-heading leading-tight"
            >
              {t("receiptTitle")}
            </h3>
          </div>
          <p className="mt-1 text-xs text-white/90 sm:text-sm">
            {t("issuedBy", { platform: PLATFORM_NAME, taxId })}
          </p>
        </header>

        <dl className="divide-y divide-zinc-900/5 px-4 sm:px-6 dark:divide-white/10">
          {fields.map((field) => (
            <div
              key={field.key}
              className="grid grid-cols-1 gap-0.5 py-2.5 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)] sm:gap-4"
            >
              <dt className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                {t(field.key)}
              </dt>
              <dd
                className={cn(
                  "text-sm font-medium text-zinc-900 [overflow-wrap:anywhere] dark:text-zinc-50",
                  field.mono && "font-mono text-xs",
                )}
              >
                {field.value || "—"}
              </dd>
            </div>
          ))}
        </dl>

        {taxId === PLACEHOLDER_TAX_ID && (
          <div className="px-4 pb-3 sm:px-6">
            <Badge tone="warning" size="sm">
              {t("placeholderTaxId")}
            </Badge>
          </div>
        )}

        <p className="border-t border-zinc-900/5 px-4 py-3 text-[11px] leading-relaxed text-zinc-600 sm:px-6 dark:border-white/10 dark:text-zinc-400">
          {t("disclaimer")}
        </p>
      </div>

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
        <Button variant="secondary" fullWidth onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("back")}
        </Button>
        <Button
          fullWidth
          onClick={() => downloadTaxReceipt(data)}
          className="bg-linear-to-r from-brand to-accent hover:opacity-90"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          {t("print")}
        </Button>
      </div>
    </motion.section>
  );
}
