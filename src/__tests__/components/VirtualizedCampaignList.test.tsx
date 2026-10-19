import { render, screen } from "@testing-library/react";
import VirtualizedCampaignList from "@/components/VirtualizedCampaignList";

interface Item {
  id: number;
  title: string;
}

function makeItems(count: number): Item[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `Campaign ${i + 1}`,
  }));
}

const renderSingleColumn = (items: Item[], extra: Record<string, unknown> = {}) =>
  render(
    <VirtualizedCampaignList
      items={items}
      estimateRowHeight={120}
      rowClassName="pb-3"
      role="list"
      renderRow={(row) => row.map((item) => <span key={item.id}>{item.title}</span>)}
      {...extra}
    />,
  );

describe("VirtualizedCampaignList — issue #1146", () => {
  it("does not mount a DOM node for every item when the list is large", () => {
    renderSingleColumn(makeItems(500));

    const rendered = screen.queryAllByText(/^Campaign \d+$/);
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(500);
  });

  it("renders every item when the list is small", () => {
    renderSingleColumn(makeItems(3));

    expect(screen.getByText("Campaign 1")).toBeInTheDocument();
    expect(screen.getByText("Campaign 2")).toBeInTheDocument();
    expect(screen.getByText("Campaign 3")).toBeInTheDocument();
  });

  it("exposes list semantics on the container and rows when role=list", () => {
    const { container } = renderSingleColumn(makeItems(5));

    expect(container.querySelector('[role="list"]')).not.toBeNull();
    const listItems = container.querySelectorAll('[role="listitem"]');
    expect(listItems.length).toBeGreaterThan(0);
    expect(listItems.length).toBeLessThanOrEqual(5);
  });

  it("chunks grid rows by the responsive column count", () => {
    // jsdom reports innerWidth=1024, so the 640px breakpoint activates 2 columns.
    render(
      <VirtualizedCampaignList
        items={makeItems(200)}
        columnBreakpoints={[
          { minWidth: 0, columns: 1 },
          { minWidth: 640, columns: 2 },
        ]}
        estimateRowHeight={150}
        rowClassName="grid"
        renderRow={(row) => row.map((item) => <span key={item.id}>{item.title}</span>)}
      />,
    );

    const rendered = screen.queryAllByText(/^Campaign \d+$/);
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(200);
    // With 2 columns, never an odd number of mounted cards.
    expect(rendered.length % 2).toBe(0);
  });

  it("renders the full grid when small enough to fit without virtualization", () => {
    const { container } = render(
      <VirtualizedCampaignList
        items={makeItems(4)}
        columnBreakpoints={[
          { minWidth: 0, columns: 1 },
          { minWidth: 640, columns: 2 },
        ]}
        renderRow={(row) => row.map((item) => <span key={item.id}>{item.title}</span>)}
      />,
    );

    expect(screen.getByText("Campaign 1")).toBeInTheDocument();
    expect(screen.getByText("Campaign 4")).toBeInTheDocument();
    expect(container.querySelector('[role="list"]')).toBeNull();
  });
});
