import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CreatorProfileHeader from "@/components/CreatorProfileHeader";
import { creatorProfileKey, EMPTY_CREATOR_PROFILE, saveCreatorProfile } from "@/lib/creatorProfile";

describe("CreatorProfileHeader", () => {
  beforeEach(() => window.localStorage.clear());

  it("saves customization per wallet and restores it on remount", () => {
    const { unmount } = render(
      <CreatorProfileHeader address="GWALLET1" verifiedCampaignCount={0} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    fireEvent.change(screen.getByLabelText("displayName"), {
      target: { value: "School Builders" },
    });
    fireEvent.change(screen.getByLabelText("website"), {
      target: { value: "https://example.org" },
    });
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    expect(screen.getByRole("status")).toHaveTextContent("saved");
    expect(screen.getByRole("link", { name: /website/ })).toHaveAttribute(
      "href",
      "https://example.org",
    );
    unmount();

    const view = render(<CreatorProfileHeader address="GWALLET1" verifiedCampaignCount={0} />);
    expect(screen.getByRole("heading", { name: "School Builders" })).toBeInTheDocument();
    view.rerender(
      <CreatorProfileHeader key="GWALLET2" address="GWALLET2" verifiedCampaignCount={0} />,
    );
    expect(screen.queryByRole("heading", { name: "School Builders" })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(creatorProfileKey("GWALLET2"))).toBeNull();
  });

  it("discards unsaved edits and never offers editable verification", () => {
    render(<CreatorProfileHeader address="GWALLET1" verifiedCampaignCount={0} />);
    expect(screen.queryByText("verified")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    fireEvent.change(screen.getByLabelText("displayName"), { target: { value: "Unsaved name" } });
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    expect(screen.queryByText("Unsaved name")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(creatorProfileKey("GWALLET1"))).toBeNull();
  });

  it("shows social proof only when verified campaigns exist", () => {
    render(<CreatorProfileHeader address="GWALLET1" verifiedCampaignCount={2} />);
    expect(screen.getByText("verified")).toHaveAttribute("title", "verifiedHelp");
  });

  it("previews an image, saves it and allows its removal", async () => {
    render(<CreatorProfileHeader address="GWALLET1" verifiedCampaignCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    fireEvent.change(screen.getByLabelText("banner"), {
      target: { files: [new File(["image bytes"], "banner.png", { type: "image/png" })] },
    });
    const image = await screen.findByRole("img", { name: "bannerAlt" });
    expect(image.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
    await waitFor(() => expect(screen.getByRole("button", { name: "save" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    expect(JSON.parse(window.localStorage.getItem(creatorProfileKey("GWALLET1"))!).banner).toMatch(
      /^data:image\/png/,
    );
    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    fireEvent.click(screen.getByRole("button", { name: "removeBanner" }));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    expect(JSON.parse(window.localStorage.getItem(creatorProfileKey("GWALLET1"))!).banner).toBe("");
  });

  it.each([
    new File(["<svg/>"], "banner.svg", { type: "image/svg+xml" }),
    new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }),
  ])("rejects unsupported or oversized banners", (file) => {
    render(<CreatorProfileHeader address="GWALLET1" verifiedCampaignCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    fireEvent.change(screen.getByLabelText("banner"), { target: { files: [file] } });
    expect(screen.getByRole("alert")).toHaveTextContent("invalidBanner");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("rejects unsafe links even when browser form validation is bypassed", () => {
    render(<CreatorProfileHeader address="GWALLET1" verifiedCampaignCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    fireEvent.change(screen.getByLabelText("website"), {
      target: { value: "javascript:alert(1)" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "save" }).closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent("invalidLink");
    expect(window.localStorage.getItem(creatorProfileKey("GWALLET1"))).toBeNull();
  });

  it("reports a failed save instead of claiming persistence", () => {
    const storage = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Quota exceeded");
    });
    render(<CreatorProfileHeader address="GWALLET1" verifiedCampaignCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "edit" }));
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("saveError");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    storage.mockRestore();
  });

  it("ignores malformed or unsafe stored profiles", () => {
    window.localStorage.setItem(
      creatorProfileKey("GWALLET1"),
      JSON.stringify({
        ...EMPTY_CREATOR_PROFILE,
        displayName: "Untrusted",
        links: { website: "javascript:alert(1)", twitter: "", linkedin: "" },
      }),
    );
    render(<CreatorProfileHeader address="GWALLET1" verifiedCampaignCount={0} />);
    expect(screen.queryByText("Untrusted")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(() =>
      saveCreatorProfile("GWALLET1", {
        ...EMPTY_CREATOR_PROFILE,
        banner: "https://untrusted.example/image.svg",
      }),
    ).toThrow();
  });
});
