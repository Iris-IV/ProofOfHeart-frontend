import { fireEvent, render, screen } from "@testing-library/react";
import ContributionTicker from "@/components/ContributionTicker";
import type { ContributionFeedEvent } from "@/lib/contributionFeed";

const donation = (id: string): ContributionFeedEvent => ({
  id, contributor: `GDONOR${id}`, amount: 10000000n, ledgerClosedAt: "2026-10-18T12:00:00Z",
});

it("pauses only the displayed feed and resumes with the latest donations", () => {
  const { rerender } = render(<ContributionTicker events={[donation("1")]} status="live" />);
  fireEvent.click(screen.getByRole("button", { name: "pause" }));
  rerender(<ContributionTicker events={[donation("2"), donation("1")]} status="live" />);
  expect(screen.queryByText("GDONOR2")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "resume" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "resume" }));
  expect(screen.getByText("GDONOR2")).toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
});

it.each(["connecting", "reconnecting", "paused", "unavailable", "mock"] as const)("explains the %s state without inventing donations", (status) => {
  render(<ContributionTicker events={[]} status={status} />);
  expect(screen.getByRole("status")).toHaveTextContent(status);
  expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
});

it("keeps the scrollable feed keyboard accessible and tolerates missing timestamps", () => {
  render(<ContributionTicker events={[{ ...donation("1"), ledgerClosedAt: "invalid" }]} status="live" />);
  expect(screen.getByRole("region", { name: "recent" })).toHaveAttribute("tabindex", "0");
  expect(screen.getByRole("list")).toHaveAttribute("aria-live", "off");
  expect(screen.getByText("GDONOR1")).toBeInTheDocument();
});
