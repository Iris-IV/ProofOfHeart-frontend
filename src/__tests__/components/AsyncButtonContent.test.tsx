import { render, screen } from "@testing-library/react";
import AsyncButtonContent from "@/components/AsyncButtonContent";

describe("AsyncButtonContent", () => {
  it("renders the idle label when not pending", () => {
    render(<AsyncButtonContent isPending={false} idleLabel={<span>Submit</span>} />);
    expect(screen.getByText("Submit")).toBeInTheDocument();
  });

  it("renders the spinner and pending label when pending", () => {
    render(<AsyncButtonContent isPending={true} idleLabel="Submit" pendingLabel="Saving..." />);
    const labels = screen.getAllByText("Saving...");
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it("uses default pending label when none is provided", () => {
    render(<AsyncButtonContent isPending={true} idleLabel="Submit" />);
    const labels = screen.getAllByText("Processing...");
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it("has an aria-live region that toggles with loading state", () => {
    const { rerender } = render(<AsyncButtonContent isPending={false} idleLabel="Submit" />);
    const liveRegion = screen.getByText("Ready").closest('[aria-live="polite"]');
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
    expect(liveRegion).toHaveAttribute("aria-atomic", "true");

    rerender(<AsyncButtonContent isPending={true} idleLabel="Submit" pendingLabel="Saving..." />);
    const pendingLiveRegions = screen.getAllByText("Saving...");
    const pendingLiveRegion = pendingLiveRegions[0].closest('[aria-live="polite"]');
    expect(pendingLiveRegion).toHaveAttribute("aria-live", "polite");
    expect(pendingLiveRegion).toHaveAttribute("aria-atomic", "true");
  });

  it("hides the spinner from assistive tech when pending", () => {
    const { container } = render(
      <AsyncButtonContent isPending={true} idleLabel="Submit" pendingLabel="Saving..." />,
    );
    const spinner = container.querySelector('[aria-hidden="true"]');
    expect(spinner).toBeInTheDocument();
  });
});
