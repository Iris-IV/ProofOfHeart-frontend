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

describe("EditCampaignMetadata — form validation (issue #1217)", () => {
  const props = {
    campaignId: 42,
    initialTitle: "Clean water for the village",
    initialDescription: "A campaign description.",
    initialCoverImageUrl: "https://example.com/cover.jpg",
  };
  const storageKey = "poh_meta_override_42";

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  function openPanel() {
    render(<EditCampaignMetadata {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /editMetadata/i }));
  }

  it("shows the error inline and does not persist when the image URL is invalid", () => {
    const setItem = jest.spyOn(Storage.prototype, "setItem");
    openPanel();

    fireEvent.change(screen.getByLabelText("coverImageUrlLabel"), {
      target: { value: "not-a-url" },
    });
    fireEvent.click(screen.getByRole("button", { name: /saveButton/i }));

    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent("coverImageUrlInvalid");
    expect(screen.getByLabelText("coverImageUrlLabel")).toHaveAttribute("aria-invalid", "true");
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem(storageKey)).toBeNull();

    setItem.mockRestore();
  });

  it.each(["ftp://example.com/cover.jpg", "javascript:alert(1)", "example.com/cover.jpg"])(
    "rejects %s as a cover image URL",
    (value) => {
      openPanel();
      fireEvent.change(screen.getByLabelText("coverImageUrlLabel"), { target: { value } });
      fireEvent.click(screen.getByRole("button", { name: /saveButton/i }));
      expect(screen.getByRole("alert")).toBeInTheDocument();
    },
  );

  it("clears the error once the URL is corrected", () => {
    openPanel();
    const input = screen.getByLabelText("coverImageUrlLabel");

    fireEvent.change(input, { target: { value: "not-a-url" } });
    fireEvent.click(screen.getByRole("button", { name: /saveButton/i }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "https://cdn.example.com/new-cover.png" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("persists the expected payload on a successful edit", () => {
    openPanel();

    fireEvent.change(screen.getByLabelText("titleLabel"), {
      target: { value: "Updated title" },
    });
    fireEvent.change(screen.getByLabelText("descriptionLabel"), {
      target: { value: "Updated description" },
    });
    fireEvent.change(screen.getByLabelText("coverImageUrlLabel"), {
      target: { value: "https://cdn.example.com/new-cover.png" },
    });
    fireEvent.click(screen.getByRole("button", { name: /saveButton/i }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    const raw = localStorage.getItem(storageKey);
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw as string);
    expect(saved).toMatchObject({
      title: "Updated title",
      description: "Updated description",
      coverImageUrl: "https://cdn.example.com/new-cover.png",
    });
    expect(new Date(saved.editedAt).toISOString()).toBe(saved.editedAt);
  });

  it("accepts clearing the cover image URL", () => {
    openPanel();
    fireEvent.change(screen.getByLabelText("coverImageUrlLabel"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: /saveButton/i }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem(storageKey) as string);
    expect(saved.coverImageUrl).toBe("");
  });
});
