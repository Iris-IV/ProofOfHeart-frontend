import React, { useRef } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import Modal from "@/components/ui/Modal";

describe("Modal shell component", () => {
  it("renders children when isOpen is true", () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()}>
        <div>Modal Content</div>
      </Modal>,
    );

    expect(screen.getByText("Modal Content")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("returns null when isOpen is false", () => {
    const { container } = render(
      <Modal isOpen={false} onClose={jest.fn()}>
        <div>Hidden Content</div>
      </Modal>,
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("Hidden Content")).not.toBeInTheDocument();
  });

  it("sets accessible aria attributes", () => {
    render(
      <Modal
        isOpen={true}
        onClose={jest.fn()}
        ariaLabelledBy="modal-title"
        ariaDescribedBy="modal-desc"
        role="alertdialog"
      >
        <h2 id="modal-title">Title</h2>
        <p id="modal-desc">Description</p>
      </Modal>,
    );

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "modal-title");
    expect(dialog).toHaveAttribute("aria-describedby", "modal-desc");
  });

  it("triggers onClose when Escape key is pressed", () => {
    const handleClose = jest.fn();
    render(
      <Modal isOpen={true} onClose={handleClose}>
        <div>Content</div>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("does not trigger onClose on Escape when closeOnEscape is false", () => {
    const handleClose = jest.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} closeOnEscape={false}>
        <div>Content</div>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(handleClose).not.toHaveBeenCalled();
  });

  it("triggers onClose when clicking backdrop overlay", () => {
    const handleClose = jest.fn();
    render(
      <Modal isOpen={true} onClose={handleClose}>
        <div>Content</div>
      </Modal>,
    );

    const overlay = screen.getByTestId("modal-overlay");
    fireEvent.click(overlay);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("does not trigger onClose when clicking modal content dialog", () => {
    const handleClose = jest.fn();
    render(
      <Modal isOpen={true} onClose={handleClose}>
        <button>Inside Button</button>
      </Modal>,
    );

    fireEvent.click(screen.getByText("Inside Button"));
    expect(handleClose).not.toHaveBeenCalled();
  });

  it("traps Tab focus within the modal", async () => {
    jest.useFakeTimers();
    render(
      <Modal isOpen={true} onClose={jest.fn()}>
        <button id="btn1">Button 1</button>
        <button id="btn2">Button 2</button>
      </Modal>,
    );

    const btn1 = screen.getByRole("button", { name: "Button 1" });
    const btn2 = screen.getByRole("button", { name: "Button 2" });

    act(() => {
      jest.runAllTimers();
    });

    btn2.focus();
    expect(document.activeElement).toBe(btn2);

    // Tab from last element wraps to first
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(btn1);

    // Shift+Tab from first element wraps to last
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(btn2);
    jest.useRealTimers();
  });

  it("locks body overflow when open and restores it when unmounted", () => {
    document.body.style.overflow = "auto";

    const { unmount } = render(
      <Modal isOpen={true} onClose={jest.fn()}>
        <div>Scroll Locked</div>
      </Modal>,
    );

    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("supports initialFocusRef", () => {
    jest.useFakeTimers();
    function TestComponent() {
      const inputRef = useRef<HTMLInputElement>(null);
      return (
        <Modal isOpen={true} onClose={jest.fn()} initialFocusRef={inputRef}>
          <button>First Button</button>
          <input ref={inputRef} placeholder="Target Input" />
        </Modal>
      );
    }

    render(<TestComponent />);

    act(() => {
      jest.runAllTimers();
    });

    expect(document.activeElement).toBe(screen.getByPlaceholderText("Target Input"));
    jest.useRealTimers();
  });
});
