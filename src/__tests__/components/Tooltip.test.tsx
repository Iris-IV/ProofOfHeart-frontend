import { fireEvent, render, screen } from "@testing-library/react";
import Tooltip from "@/components/Tooltip";

const CONTENT = "A platform fee of 3% is deducted when the creator withdraws.";

// React derives onPointerEnter/onPointerLeave from pointerover/pointerout, so
// tests have to dispatch those rather than the enter/leave events directly.
/** Simulates a real tap: touch pointer events followed by a click. */
function tap(element: HTMLElement) {
  fireEvent.pointerOver(element, { pointerType: "touch" });
  fireEvent.pointerDown(element, { pointerType: "touch" });
  fireEvent.focus(element);
  fireEvent.click(element);
}

function getTrigger() {
  return screen.getByRole("button", { name: /more information/i });
}

describe("Tooltip", () => {
  it("is closed initially", () => {
    render(<Tooltip content={CONTENT} />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(getTrigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("opens on tap and stays open on touch devices (#1154)", () => {
    render(<Tooltip content={CONTENT} />);
    const trigger = getTrigger();

    tap(trigger);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent(CONTENT);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-describedby", tooltip.id);
  });

  it("closes on a second tap", () => {
    render(<Tooltip content={CONTENT} />);
    const trigger = getTrigger();

    tap(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.pointerDown(trigger, { pointerType: "touch" });
    fireEvent.click(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("closes when tapping outside", () => {
    render(<Tooltip content={CONTENT} />);
    tap(getTrigger());
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.pointerDown(document.body, { pointerType: "touch" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(<Tooltip content={CONTENT} />);
    tap(getTrigger());
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("still opens on mouse hover and closes when the pointer leaves", () => {
    render(<Tooltip content={CONTENT} />);
    const trigger = getTrigger();

    fireEvent.pointerOver(trigger, { pointerType: "mouse" });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.pointerOut(trigger, { pointerType: "mouse", relatedTarget: document.body });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("opens on keyboard focus and closes on blur", () => {
    render(<Tooltip content={CONTENT} />);
    const trigger = getTrigger();

    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.blur(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("gives each instance a unique tooltip id", () => {
    render(
      <>
        <Tooltip content="First" label="First info" />
        <Tooltip content="Second" label="Second info" />
      </>,
    );

    fireEvent.focus(screen.getByRole("button", { name: "First info" }));
    fireEvent.focus(screen.getByRole("button", { name: "Second info" }));

    const [first, second] = screen.getAllByRole("tooltip");
    expect(first.id).not.toBe(second.id);
  });
});
