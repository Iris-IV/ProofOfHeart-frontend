import { useId } from "react";
import { Spinner } from "./Skeleton";
import type { ReactNode } from "react";

interface AsyncButtonContentProps {
  isPending: boolean;
  idleLabel: ReactNode;
  pendingLabel?: string;
  spinnerClassName?: string;
}

export default function AsyncButtonContent({
  isPending,
  idleLabel,
  pendingLabel = "Processing...",
  spinnerClassName,
}: AsyncButtonContentProps) {
  const liveRegionId = useId();

  if (!isPending) {
    return (
      <>
        {idleLabel}
        <span
          id={liveRegionId}
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          Ready
        </span>
      </>
    );
  }

  return (
    <>
      <span
        id={liveRegionId}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {pendingLabel}
      </span>
      <Spinner className={spinnerClassName} aria-hidden="true" />
      <span>{pendingLabel}</span>
    </>
  );
}
