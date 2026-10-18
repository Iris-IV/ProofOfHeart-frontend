"use client";

import { useCallback, useRef } from "react";
import { cn } from "./cn";

export interface TabItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  /** Optional count rendered after the label (e.g. number of updates). */
  count?: number;
}

/** Element ids are derived, not generated, so `Tabs` and `TabPanel` agree. */
export const tabButtonId = (idPrefix: string, tabId: string) => `${idPrefix}-tab-${tabId}`;
export const tabPanelId = (idPrefix: string, tabId: string) => `${idPrefix}-panel-${tabId}`;

export interface TabsProps<T extends string = string> {
  tabs: ReadonlyArray<TabItem<T>>;
  activeId: T;
  onChange: (id: T) => void;
  /** Accessible name for the tablist, e.g. "Campaign sections". */
  label: string;
  /** Unique per tablist on the page — keeps element ids from colliding. */
  idPrefix: string;
  className?: string;
}

/**
 * Accessible tab bar following the WAI-ARIA tabs pattern: roving tabindex,
 * arrow-key navigation with wraparound, Home/End, and `aria-controls` pointing
 * at the panel.
 *
 * Panels are rendered by the caller with {@link TabPanel} so each screen keeps
 * control over mounting — the campaign page, for instance, must not mount the
 * comments query until its tab is opened.
 */
export default function Tabs<T extends string = string>({
  tabs,
  activeId,
  onChange,
  label,
  idPrefix,
  className,
}: TabsProps<T>) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const selectAndFocus = useCallback(
    (id: T) => {
      onChange(id);
      // Focus follows selection in an automatic-activation tablist.
      requestAnimationFrame(() => tabRefs.current[id]?.focus());
    },
    [onChange],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const index = tabs.findIndex((tab) => tab.id === activeId);
    if (index === -1) return;

    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        selectAndFocus(tabs[(index + 1) % tabs.length].id);
        break;
      case "ArrowLeft":
        event.preventDefault();
        selectAndFocus(tabs[(index - 1 + tabs.length) % tabs.length].id);
        break;
      case "Home":
        event.preventDefault();
        selectAndFocus(tabs[0].id);
        break;
      case "End":
        event.preventDefault();
        selectAndFocus(tabs[tabs.length - 1].id);
        break;
    }
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("flex gap-1 border-b border-zinc-200 dark:border-zinc-700", className)}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              tabRefs.current[tab.id] = node;
            }}
            role="tab"
            type="button"
            id={tabButtonId(idPrefix, tab.id)}
            aria-selected={isActive}
            aria-controls={tabPanelId(idPrefix, tab.id)}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={handleKeyDown}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px tap-target focus-ring rounded-t-md",
              "transition-colors duration-(--duration-fast) inline-flex items-center gap-2",
              isActive
                ? "border-brand text-brand dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200",
            )}
          >
            {tab.label}
            {typeof tab.count === "number" && tab.count > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  isActive
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Must match the `id` of the tab that controls this panel. */
  tabId: string;
  /** Must match the `idPrefix` given to the matching {@link Tabs}. */
  idPrefix: string;
  active: boolean;
}

/**
 * Panel for a {@link Tabs} tab. Renders nothing when inactive so heavy panels
 * (queries, maps, editors) stay unmounted until opened.
 */
export function TabPanel({
  tabId,
  idPrefix,
  active,
  className,
  children,
  ...props
}: TabPanelProps) {
  if (!active) return null;

  return (
    <div
      role="tabpanel"
      id={tabPanelId(idPrefix, tabId)}
      aria-labelledby={tabButtonId(idPrefix, tabId)}
      // The WAI-ARIA tabs pattern requires a focusable panel: after activating
      // a tab, Tab must move into the panel even when its first child is not
      // itself focusable. The lint rule does not model that exception.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      className={cn("focus-ring rounded-md", className)}
      {...props}
    >
      {children}
    </div>
  );
}
