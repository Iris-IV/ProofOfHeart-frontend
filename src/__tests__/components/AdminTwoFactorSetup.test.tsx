import { render, screen, fireEvent } from "@testing-library/react";
import AdminTwoFactorSetup from "@/components/admin/AdminTwoFactorSetup";

function goToVerifyStep() {
  render(<AdminTwoFactorSetup adminAddress="GABCDEFGHIJKLMNOPQRSTUVWXYZ234567" />);
  fireEvent.click(screen.getByRole("button", { name: /set up 2fa/i }));
  fireEvent.click(screen.getByRole("button", { name: /i've scanned it/i }));
}

describe("AdminTwoFactorSetup — accessibility (issue #676)", () => {
  it("associates the verification error with the code input via aria-describedby", () => {
    goToVerifyStep();

    const input = screen.getByLabelText("One-time password");
    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.submit(input.closest("form")!);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Enter the 6-digit code from your authenticator app.");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toBe(alert.id);
  });

  it("does not mark the input invalid before any submission", () => {
    goToVerifyStep();
    expect(screen.getByLabelText("One-time password")).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
