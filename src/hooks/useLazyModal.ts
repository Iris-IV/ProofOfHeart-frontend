import { createElement, lazy, Suspense, useMemo } from "react";
import type { ComponentType } from "react";

interface LazyModalOptions {
  fallback?: React.ReactNode;
}

export function useLazyModal<P extends Record<string, any>>(
  loader: () => Promise<{ default: ComponentType<P> }>,
  options: LazyModalOptions = {},
) {
  return useMemo(() => {
    const Component = lazy(loader);

    return {
      Component: (props: P) =>
        createElement(
          Suspense,
          { fallback: options.fallback || createElement("div", null, "Loading...") },
          createElement(Component, props),
        ),
    };
  }, [loader, options.fallback]);
}
