import { lazy, Suspense, useMemo } from "react";
import type { ComponentType } from "react";

interface LazyModalOptions {
  fallback?: React.ReactNode;
}

export function useLazyModal<P extends Record<string, any>>(
  loader: () => Promise<{ default: ComponentType<P> }>,
  options: LazyModalOptions = {}
) {
  return useMemo(() => {
    const Component = lazy(loader);

    return {
      Component: (props: P) => (
        <Suspense fallback={options.fallback || <div>Loading...</div>}>
          <Component {...props} />
        </Suspense>
      ),
    };
  }, [loader, options.fallback]);
}

// Pre-configured lazy modals for common heavy components
export const TaxReceiptModal = useLazyModal(
  () => import("../components/modals/TaxReceiptModal").then(m => ({ default: m.TaxReceiptModal })),
  { fallback: <div>Loading tax receipt...</div> }
);

export const RevenueSplitModal = useLazyModal(
  () => import("../components/modals/RevenueSplitModal").then(m => ({ default: m.RevenueSplitModal })),
  { fallback: <div>Loading revenue split...</div> }
);
