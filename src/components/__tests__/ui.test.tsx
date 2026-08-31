import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  Input,
  TabPanel,
  Tabs,
  Textarea,
} from "@/components/ui";

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

describe("Button", () => {
  it("renders its label and fires onClick", async () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Donate</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Donate" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("defaults to type=button so it cannot submit a form by accident", () => {
    render(<Button>Cancel</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("is disabled and marked busy while loading", () => {
    render(
      <Button isLoading loadingLabel="Posting…">
        Post Update
      </Button>,
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveTextContent("Posting…");
  });

  it("swallows clicks while loading", async () => {
    const onClick = jest.fn();
    render(
      <Button isLoading onClick={onClick}>
        Post
      </Button>,
    );

    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps the caller's className last so it can override", () => {
    render(<Button className="custom-class">Go</Button>);
    expect(screen.getByRole("button").className).toMatch(/custom-class$/);
  });
});

// ---------------------------------------------------------------------------
// Card + Badge
// ---------------------------------------------------------------------------

describe("Card", () => {
  it("renders as the requested element", () => {
    render(
      <Card as="section" aria-label="Panel">
        <CardTitle>Heading</CardTitle>
      </Card>,
    );

    expect(screen.getByRole("region", { name: "Panel" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Heading" })).toBeInTheDocument();
  });

  it("styles its title from the typography tokens, not a hardcoded size", () => {
    render(<CardTitle>Heading</CardTitle>);
    const heading = screen.getByRole("heading", { name: "Heading" });

    expect(heading.className).toMatch(/\btext-heading\b/);
    expect(heading.className).toMatch(/\bfont-heading\b/);
  });

  it("spaces its header from the card-gap token, not a raw utility", () => {
    render(
      <CardHeader>
        <CardTitle>Heading</CardTitle>
      </CardHeader>,
    );

    expect(screen.getByRole("heading").parentElement?.className).toMatch(/\bgap-card-gap\b/);
  });
});

describe("Badge", () => {
  it("renders its content", () => {
    render(<Badge tone="warning">Pending</Badge>);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

describe("Input / Textarea", () => {
  it("associates the label with the control", () => {
    render(<Input label="Signer address" />);
    expect(screen.getByLabelText("Signer address")).toBeInTheDocument();
  });

  it("exposes the error to assistive tech", () => {
    render(<Input label="Goal" error="Must be greater than zero." />);

    const input = screen.getByLabelText("Goal");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Must be greater than zero.");
    expect(input.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
  });

  it("describes the control with its hint when there is no error", () => {
    render(<Textarea label="Update" hint="Markdown supported." />);

    const textarea = screen.getByLabelText("Update");
    expect(textarea).not.toHaveAttribute("aria-invalid");
    expect(textarea.getAttribute("aria-describedby")).toBe(
      screen.getByText("Markdown supported.").id,
    );
  });
});

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const TABS = [
  { id: "updates" as const, label: "Updates" },
  { id: "comments" as const, label: "Comments" },
];

function TabsHarness() {
  const [active, setActive] = useState<"updates" | "comments">("updates");

  return (
    <>
      <Tabs
        tabs={TABS}
        activeId={active}
        onChange={setActive}
        label="Campaign sections"
        idPrefix="test"
      />
      <TabPanel tabId="updates" idPrefix="test" active={active === "updates"}>
        Updates panel
      </TabPanel>
      <TabPanel tabId="comments" idPrefix="test" active={active === "comments"}>
        Comments panel
      </TabPanel>
    </>
  );
}

describe("Tabs", () => {
  it("shows only the active panel", () => {
    render(<TabsHarness />);

    expect(screen.getByText("Updates panel")).toBeInTheDocument();
    expect(screen.queryByText("Comments panel")).not.toBeInTheDocument();
  });

  it("switches panels on click", async () => {
    render(<TabsHarness />);

    await userEvent.click(screen.getByRole("tab", { name: "Comments" }));

    expect(screen.getByText("Comments panel")).toBeInTheDocument();
    expect(screen.queryByText("Updates panel")).not.toBeInTheDocument();
  });

  it("wires aria-controls to the panel it opens", async () => {
    render(<TabsHarness />);

    const tab = screen.getByRole("tab", { name: "Updates" });
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(tab.getAttribute("aria-controls")).toBe(screen.getByRole("tabpanel").id);
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(tab.id);
  });

  it("uses a roving tabindex so the tablist is one tab stop", () => {
    render(<TabsHarness />);

    expect(screen.getByRole("tab", { name: "Updates" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Comments" })).toHaveAttribute("tabindex", "-1");
  });

  it("moves between tabs with arrow keys and wraps around", async () => {
    render(<TabsHarness />);

    screen.getByRole("tab", { name: "Updates" }).focus();

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Comments" })).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Updates" })).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Comments" })).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Updates" })).toHaveAttribute("aria-selected", "true");
  });
});
