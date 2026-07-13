import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminTwoFactorSetup from "../AdminTwoFactorSetup";

// Drive the component from the intro step to the verify step.
function goToVerifyStep() {
  render(<AdminTwoFactorSetup adminAddress="GADMIN" />);
  fireEvent.click(screen.getByRole("button", { name: /set up 2fa/i }));
  fireEvent.click(screen.getByRole("button", { name: /scanned it/i }));
}

describe("AdminTwoFactorSetup — verify button loading state (fixes #678)", () => {
  it("shows a spinner and disables the button while verifying, then completes", async () => {
    goToVerifyStep();
    fireEvent.change(screen.getByLabelText(/one-time password/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));

    // While the verify is in flight: spinner text + disabled.
    expect(screen.getByRole("button", { name: /verifying/i })).toBeDisabled();

    // After the (simulated) round-trip, the done step renders.
    await waitFor(() =>
      expect(screen.getByText(/2FA Enabled/i)).toBeInTheDocument()
    );
  });

  it("shows an error for an invalid code and re-enables the button", async () => {
    goToVerifyStep();
    fireEvent.change(screen.getByLabelText(/one-time password/i), {
      target: { value: "12" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));

    await waitFor(() =>
      expect(screen.getByText(/enter the 6-digit code/i)).toBeInTheDocument()
    );
    // Button is usable again after the failed attempt.
    expect(screen.getByRole("button", { name: /^verify$/i })).not.toBeDisabled();
  });

  it("prevents double-submission while a verify is in flight", async () => {
    goToVerifyStep();
    fireEvent.change(screen.getByLabelText(/one-time password/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));

    const busy = screen.getByRole("button", { name: /verifying/i });
    expect(busy).toBeDisabled();
    fireEvent.click(busy); // no-op: disabled + guarded handler

    // Exactly one completion — reaches the done step once.
    await waitFor(() =>
      expect(screen.getByText(/2FA Enabled/i)).toBeInTheDocument()
    );
  });
});
