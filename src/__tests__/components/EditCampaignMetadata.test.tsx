import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EditCampaignMetadata from "@/components/EditCampaignMetadata";
import { validateImageUrl } from "@/lib/imageValidation";

jest.mock("@/lib/imageValidation", () => ({
  validateImageUrl: jest.fn(),
}));

const mockValidateImageUrl = validateImageUrl as jest.MockedFunction<typeof validateImageUrl>;

const PROPS = {
  campaignId: 42,
  initialTitle: "Original Title",
  initialDescription: "Original description.",
  initialCoverImageUrl: "",
};

function renderComponent(props = {}) {
  return render(<EditCampaignMetadata {...PROPS} {...props} />);
}

describe("EditCampaignMetadata", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockValidateImageUrl.mockReturnValue({ valid: true });
  });

  // -----------------------------------------------------------------------
  // Rendering & Toggle
  // -----------------------------------------------------------------------

  it("renders the toggle button and expands the editor on click", () => {
    renderComponent();

    const toggle = screen.getByRole("button", { name: /editMetadata/ });
    expect(toggle).toBeInTheDocument();

    // Form is initially collapsed
    expect(screen.queryByText("titleLabel")).not.toBeInTheDocument();
    expect(screen.queryByText("descriptionLabel")).not.toBeInTheDocument();

    fireEvent.click(toggle);

    // Form is now visible
    expect(screen.getByText("titleLabel")).toBeInTheDocument();
    expect(screen.getByText("descriptionLabel")).toBeInTheDocument();
    expect(screen.getByText("coverImageUrlLabel")).toBeInTheDocument();
  });

  it("toggles aria-expanded on the header button", () => {
    renderComponent();
    const toggle = screen.getByRole("button", { name: /editMetadata/ });

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  // -----------------------------------------------------------------------
  // Image URL Validation
  // -----------------------------------------------------------------------

  it("shows inline error when save is clicked with an invalid image URL", async () => {
    mockValidateImageUrl.mockReturnValue({
      valid: false,
      error: "Image domain not allowed.",
    });

    renderComponent();

    // Expand the editor
    fireEvent.click(screen.getByRole("button", { name: /editMetadata/ }));

    // Type an invalid URL
    const urlInput = screen.getByRole("textbox", { name: /coverImageUrlLabel/ });
    await userEvent.type(urlInput, "https://evil.com/virus.png");

    // Click save
    fireEvent.click(screen.getByRole("button", { name: /saveButton/ }));

    expect(mockValidateImageUrl).toHaveBeenCalledWith("https://evil.com/virus.png");
    expect(screen.getByRole("alert")).toHaveTextContent("Image domain not allowed.");
    expect(urlInput).toHaveAttribute("aria-invalid", "true");
    expect(urlInput.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
  });

  it("does not validate an empty image URL (optional field)", async () => {
    renderComponent({ initialCoverImageUrl: "" });

    fireEvent.click(screen.getByRole("button", { name: /editMetadata/ }));
    fireEvent.click(screen.getByRole("button", { name: /saveButton/ }));

    // validateImageUrl should not have been called for an empty string
    expect(mockValidateImageUrl).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears the inline error when the user starts editing the URL", async () => {
    mockValidateImageUrl
      .mockReturnValueOnce({ valid: false, error: "Invalid URL." })
      .mockReturnValue({ valid: true });

    renderComponent();
    fireEvent.click(screen.getByRole("button", { name: /editMetadata/ }));

    const urlInput = screen.getByRole("textbox", { name: /coverImageUrlLabel/ });
    await userEvent.type(urlInput, "https://evil.com/img.png");
    fireEvent.click(screen.getByRole("button", { name: /saveButton/ }));

    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Clear the error by typing
    await userEvent.clear(urlInput);
    await userEvent.type(urlInput, "https://images.unsplash.com/photo-1");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Successful Save
  // -----------------------------------------------------------------------

  it("saves metadata to localStorage on successful edit", async () => {
    renderComponent();
    fireEvent.click(screen.getByRole("button", { name: /editMetadata/ }));

    const titleInput = screen.getByRole("textbox", { name: /titleLabel/ });
    const descInput = screen.getByRole("textbox", { name: /descriptionLabel/ });
    const urlInput = screen.getByRole("textbox", { name: /coverImageUrlLabel/ });

    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "New Title");
    await userEvent.clear(descInput);
    await userEvent.type(descInput, "New description.");
    await userEvent.type(urlInput, "https://images.unsplash.com/photo-1");

    fireEvent.click(screen.getByRole("button", { name: /saveButton/ }));

    const storageKey = "poh_meta_override_42";
    const stored = JSON.parse(localStorage.getItem(storageKey) || "{}");

    expect(stored.title).toBe("New Title");
    expect(stored.description).toBe("New description.");
    expect(stored.coverImageUrl).toBe("https://images.unsplash.com/photo-1");
    expect(stored.editedAt).toBeDefined();
  });

  it("shows the audit trail timestamp after saving", () => {
    renderComponent();
    fireEvent.click(screen.getByRole("button", { name: /editMetadata/ }));

    const titleInput = screen.getByRole("textbox", { name: /titleLabel/ });
    fireEvent.change(titleInput, { target: { value: "Audited Title" } });

    fireEvent.click(screen.getByRole("button", { name: /saveButton/ }));

    expect(screen.getByText(/lastEdited/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clearEdits/ })).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Clear
  // -----------------------------------------------------------------------

  it("clears the override and restores initial values", () => {
    // First, set up a saved override
    const storageKey = "poh_meta_override_42";
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        title: "Saved Title",
        description: "Saved description.",
        coverImageUrl: "https://images.unsplash.com/photo-1",
        editedAt: new Date().toISOString(),
      }),
    );

    renderComponent();
    fireEvent.click(screen.getByRole("button", { name: /editMetadata/ }));

    // The override should be loaded
    expect(screen.getByRole("textbox", { name: /titleLabel/ })).toHaveValue("Saved Title");

    // Click clear
    fireEvent.click(screen.getByRole("button", { name: /clearEdits/ }));

    // Fields should be restored to initial values
    expect(screen.getByRole("textbox", { name: /titleLabel/ })).toHaveValue("Original Title");
    expect(screen.getByRole("textbox", { name: /descriptionLabel/ })).toHaveValue(
      "Original description.",
    );
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  // -----------------------------------------------------------------------
  // localStorage error resilience
  // -----------------------------------------------------------------------

  it("handles corrupt localStorage data gracefully", () => {
    const storageKey = "poh_meta_override_42";
    localStorage.setItem(storageKey, "not valid json");

    renderComponent();
    fireEvent.click(screen.getByRole("button", { name: /editMetadata/ }));

    // Should show initial values since parsing failed
    expect(screen.getByRole("textbox", { name: /titleLabel/ })).toHaveValue("Original Title");
  });
});
