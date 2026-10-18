import { fireEvent, render, screen } from "@testing-library/react";
import CampaignEmptyState from "@/components/CampaignEmptyState";

it.each(["search", "bookmarks", "campaigns"] as const)("renders the %s state with an accessible quick action", (variant) => {
  const onClick = jest.fn();
  const { container } = render(
    <CampaignEmptyState variant={variant} title="No campaigns" description="Try exploring a different cause." action={<button onClick={onClick}>Explore</button>} />,
  );
  expect(screen.getByRole("region", { name: "No campaigns" })).toBeInTheDocument();
  expect(screen.getByText("Try exploring a different cause.")).toBeInTheDocument();
  expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  fireEvent.click(screen.getByRole("button", { name: "Explore" }));
  expect(onClick).toHaveBeenCalledTimes(1);
});

it("renders suggested categories alongside its primary action", () => {
  render(
    <CampaignEmptyState variant="search" title="No matches" description="Reset your filters." action={<button>Reset</button>}>
      <button>Education</button>
    </CampaignEmptyState>,
  );
  expect(screen.getByRole("button", { name: "Education" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
});
