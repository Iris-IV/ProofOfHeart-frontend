"use client";

import { useLocale, useTranslations } from "next-intl";
import Tooltip from "./Tooltip";
import { formatStroops, getXlmAmountExplanation } from "@/lib/formatters";
import { STROOPS_PER_XLM } from "@/lib/stellarAmount";

export type Web3Topic = "stroops" | "escrow" | "multiToken";

/** Literal message keys per topic, so each key is greppable and type-checked. */
const TOPIC_KEYS = {
  stroops: { title: "stroopsTitle", label: "stroopsLabel", body: "stroopsBody" },
  escrow: { title: "escrowTitle", label: "escrowLabel", body: "escrowBody" },
  multiToken: { title: "multiTokenTitle", label: "multiTokenLabel", body: "multiTokenBody" },
} as const;

interface Web3ExplainerProps {
  topic: Web3Topic;
  /** For "stroops": the amount being explained, in stroops. */
  amount?: bigint;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

/**
 * Info tooltip that explains a Stellar / Soroban concept in plain words
 * (#1356): what a stroop is (with the exact value of `amount`), how escrowed
 * contributions are released or refunded, and which token donations settle in.
 */
export default function Web3Explainer({
  topic,
  amount,
  side = "top",
  className,
}: Web3ExplainerProps) {
  const t = useTranslations("Web3Help");
  const locale = useLocale();

  const keys = TOPIC_KEYS[topic];
  const content =
    topic === "stroops" && amount !== undefined
      ? t("stroopsAmount", { ...getXlmAmountExplanation(amount, locale) })
      : t(keys.body, { stroopsPerXlm: formatStroops(STROOPS_PER_XLM, locale) });

  return (
    <Tooltip
      title={t(keys.title)}
      content={content}
      label={t(keys.label)}
      side={side}
      className={className}
    />
  );
}
