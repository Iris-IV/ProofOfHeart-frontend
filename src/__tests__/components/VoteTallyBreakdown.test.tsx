import { render, screen } from "@testing-library/react";
import VoteTallyBreakdown from "@/components/VoteTallyBreakdown";
import { getVoteBreakdown } from "@/hooks/useLiveVoteTallies";

// Interpolating stand-in so labels can be asserted with their values.
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

describe("getVoteBreakdown", () => {
  it("returns whole-number shares that add up to 100", () => {
    expect(getVoteBreakdown({ upvotes: 2, downvotes: 1 })).toEqual({
      approvePct: 67,
      rejectPct: 33,
      hasVotes: true,
      leading: "approve",
    });
    const { approvePct, rejectPct } = getVoteBreakdown({ upvotes: 1, downvotes: 2 });
    expect(approvePct + rejectPct).toBe(100);
  });

  it("reports who is leading, including ties", () => {
    expect(getVoteBreakdown({ upvotes: 1, downvotes: 3 }).leading).toBe("reject");
    expect(getVoteBreakdown({ upvotes: 5, downvotes: 5 })).toMatchObject({
      approvePct: 50,
      rejectPct: 50,
      leading: "tie",
    });
  });

  it("does not fake a 50/50 split when nobody has voted", () => {
    expect(getVoteBreakdown({ upvotes: 0, downvotes: 0 })).toEqual({
      approvePct: 0,
      rejectPct: 0,
      hasVotes: false,
      leading: "none",
    });
  });

  it("ignores negative counts", () => {
    expect(getVoteBreakdown({ upvotes: -3, downvotes: 4 })).toMatchObject({
      approvePct: 0,
      rejectPct: 100,
    });
  });
});

describe("VoteTallyBreakdown", () => {
  it("renders proportional segments with percentage badges", () => {
    render(<VoteTallyBreakdown upvotes={3} downvotes={1} />);

    expect(screen.getByTestId("approve-segment")).toHaveStyle({ width: "75%" });
    expect(screen.getByTestId("reject-segment")).toHaveStyle({ width: "25%" });
    expect(screen.getByTestId("approve-badge")).toHaveTextContent("75%");
    expect(screen.getByTestId("reject-badge")).toHaveTextContent("25%");
    expect(screen.getByRole("img")).toHaveAccessibleName(
      'approveRejectPercent:{"approve":75,"reject":25}',
    );
    expect(screen.getByText('approveCount:{"count":3}')).toBeInTheDocument();
    expect(screen.getByText('rejectCount:{"count":1}')).toBeInTheDocument();
  });

  it("emphasises the leading side", () => {
    const { container, rerender } = render(<VoteTallyBreakdown upvotes={1} downvotes={4} />);
    expect(container.firstChild).toHaveAttribute("data-leading", "reject");
    expect(screen.getByTestId("reject-badge").className).toContain("motion-safe:scale-105");
    expect(screen.getByTestId("approve-badge").className).not.toContain("scale-105");

    rerender(<VoteTallyBreakdown upvotes={4} downvotes={1} />);
    expect(screen.getByTestId("approve-badge").className).toContain("motion-safe:scale-105");
  });

  it("shows an empty neutral track before the first vote", () => {
    render(<VoteTallyBreakdown upvotes={0} downvotes={0} />);
    expect(screen.queryByTestId("approve-segment")).toBeNull();
    expect(screen.getByRole("img")).toHaveAccessibleName("noVotesYet");
    expect(screen.getByTestId("approve-badge")).toHaveTextContent("—");
  });

  it("shows the live indicator only when streaming", () => {
    const { rerender } = render(<VoteTallyBreakdown upvotes={1} downvotes={0} />);
    expect(screen.queryByText("liveTally")).toBeNull();
    rerender(<VoteTallyBreakdown upvotes={1} downvotes={0} live />);
    expect(screen.getByText("liveTally")).toBeInTheDocument();
  });

  it("keeps segment transitions under 150ms", () => {
    render(<VoteTallyBreakdown upvotes={1} downvotes={1} />);
    expect(screen.getByTestId("approve-segment").className).toContain(
      "duration-(--duration-snappy)",
    );
  });
});
