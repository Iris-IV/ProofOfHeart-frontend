"use client";

import { useLocale } from "next-intl";
import { formatAmount, type FormatAmountOptions } from "@/lib/formatters";

interface AmountProps extends FormatAmountOptions {
    value: bigint;
    locale?: string;
    className?: string;
}

export default function Amount({
    value,
    locale,
    maximumFractionDigits,
    minimumFractionDigits,
    className,
}: AmountProps) {
    const resolvedLocale = locale ?? useLocale();

    return (
        <span className={className}>
            {formatAmount(value, resolvedLocale, {
                maximumFractionDigits,
                minimumFractionDigits,
            })}
        </span>
    );
}
