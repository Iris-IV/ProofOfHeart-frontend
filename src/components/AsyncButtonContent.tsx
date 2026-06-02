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
  if (!isPending) return <>{idleLabel}</>;

  return (
    <>
      <Spinner className={spinnerClassName} />
      <span>{pendingLabel}</span>
      <span className="sr-only">Processing request</span>
    </>
  );
}
