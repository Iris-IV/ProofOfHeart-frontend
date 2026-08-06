import { render, screen, fireEvent } from "@testing-library/react";
import EditCampaignMetadata from "@/components/EditCampaignMetadata";

describe("EditCampaignMetadata — accessibility (issue #676)", () => {
  const props = {
    campaignId: 42,
    initialTitle: "Clean water for the village",
    initialDescription: "A campaign description.",
    initialCoverImageUrl: "https://example.com/cover.jpg",
  };

  function openPanel() {
    render(<EditCampaignMetadata {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /editMetadata/i }));
  }

  it("associates the Title label with its input", () => {
    openPanel();
    expect(screen.getByLabelText("titleLabel")).toHaveValue(props.initialTitle);
  });

  it("associates the Description label with its textarea", () => {
    openPanel();
    expect(screen.getByLabelText("descriptionLabel")).toHaveValue(props.initialDescription);
  });

  it("associates the Cover Image URL label with its input", () => {
    openPanel();
    expect(screen.getByLabelText("coverImageUrlLabel")).toHaveValue(props.initialCoverImageUrl);
  });

  it("uses campaign-scoped ids so multiple instances on one page never collide", () => {
    openPanel();
    expect(screen.getByLabelText("titleLabel")).toHaveAttribute("id", "edit-meta-title-42");
  });
});
