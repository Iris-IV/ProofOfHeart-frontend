"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState, type ReactNode } from "react";

interface ColumnBreakpoint {
  /** Window width (px) at which this column count becomes active. */
  minWidth: number;
  columns: number;
}

interface VirtualizedCampaignListProps<T> {
  /** The full, unpaginated item set. Only rows near the viewport are mounted. */
  items: T[];
  /**
   * Renders one virtual row. Receives the chunk of items that belong to the
   * row: a single item for single-column lists, `columnBreakpoints` columns'
   * worth of items for grids.
   */
  renderRow: (rowItems: T[], rowIndex: number) => ReactNode;
  /**
   * Responsive column counts matched against `window.innerWidth`, mirroring
   * the Tailwind breakpoints of the grid classes passed in `rowClassName`.
   * Defaults to a single column.
   */
  columnBreakpoints?: ColumnBreakpoint[];
  /**
   * Rough row height in px used for scroll sizing before the virtualizer
   * measures the real rows. Only affects first paint, not correctness.
   */
  estimateRowHeight?: number;
  /**
   * Classes for the absolutely positioned row wrapper. Grid layout classes and
   * bottom spacing (e.g. `pb-4` to mimic a `gap-4` grid) belong here.
   */
  rowClassName?: string;
  containerClassName?: string;
  /**
   * When set, the container and each row expose list semantics
   * (`role="list"` / `role="listitem"`), preserving the accessibility of the
   * `<ul>`/`<li>` markup this component replaces. Only valid for
   * single-column lists where one row holds exactly one item.
   */
  role?: "list";
}

const DEFAULT_ESTIMATED_ROW_HEIGHT = 120;
const OVERSCAN = 3;

function useColumnCount(breakpoints: ColumnBreakpoint[] | undefined): number {
  const sorted = (breakpoints ?? [{ minWidth: 0, columns: 1 }])
    .slice()
    .sort((a, b) => a.minWidth - b.minWidth);
  // Initial state must match the server render (no window access), then the
  // effect upgrades it after hydration — same pattern as VirtualizedCauseGrid.
  const [columns, setColumns] = useState(sorted[0]?.columns ?? 1);

  useEffect(() => {
    const compute = () => {
      const width = window.innerWidth;
      let next = sorted[0]?.columns ?? 1;
      for (const bp of sorted) {
        if (width >= bp.minWidth) next = bp.columns;
      }
      return next;
    };
    setColumns(compute());

    const onResize = () => setColumns(compute());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // `sorted` is derived from the props each render; key the effect off the
    // serializable input so a fresh array identity every render can't loop.
  }, [JSON.stringify(breakpoints ?? null)]);

  return columns;
}

/**
 * Window-virtualized list for campaign collections whose DOM previously grew
 * with every item (profile saved/created campaigns, dashboard saved/submitted
 * campaigns — issue #1146). Rows are chunked by the same responsive column
 * counts as the Tailwind grid at the call site, and only rows near the
 * viewport are mounted; the rest exists purely as scroll height.
 *
 * Pairs with static data (`useCampaigns()` filters) — for cursor-paginated
 * feeds prefer `VirtualizedCauseGrid` + `useInfiniteCampaigns`.
 */
export default function VirtualizedCampaignList<T>({
  items,
  renderRow,
  columnBreakpoints,
  estimateRowHeight = DEFAULT_ESTIMATED_ROW_HEIGHT,
  rowClassName,
  containerClassName,
  role,
}: VirtualizedCampaignListProps<T>) {
  const columns = useColumnCount(columnBreakpoints);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  // Chunk into rows the way the call site's grid wraps items.
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }

  useEffect(() => {
    setScrollMargin(containerRef.current?.offsetTop ?? 0);
  }, [items.length]);

  const rowVirtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => estimateRowHeight,
    overscan: OVERSCAN,
    scrollMargin,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div
      ref={containerRef}
      className={containerClassName}
      role={role}
      style={{ position: "relative", height: rowVirtualizer.getTotalSize() }}
    >
      {virtualRows.map((virtualRow) => (
        <div
          key={virtualRow.key}
          ref={rowVirtualizer.measureElement}
          data-index={virtualRow.index}
          role={role ? "listitem" : undefined}
          className={rowClassName}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            boxSizing: "border-box",
            transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
          }}
        >
          {renderRow(rows[virtualRow.index], virtualRow.index)}
        </div>
      ))}
    </div>
  );
}
