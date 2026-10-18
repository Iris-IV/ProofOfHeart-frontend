import { render, screen, fireEvent } from "@testing-library/react";
import { StrKey } from "@stellar/stellar-sdk";
import TransferAdminModal from "@/components/TransferAdminModal";

// The modal reads a few labels from the "Admin" namespace; everything else
// arrives via props. Mirror the real translations so assertions read naturally.
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      requiredWord: "CONFIRM",
      invalidAddress: "Invalid address",
      newAdminAddress: "New Admin Address",
      transferring: "Transferring…",
    };
    return map[key] ?? key;
  },
}));

// A guaranteed well-formed Stellar public key (correct prefix, length, checksum).
const VALID_ADDRESS = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 7));
const INVALID_ADDRESS = "GNOTAREALSTELLARADDRESS";

const baseProps = {
  isOpen: true,
  isTransferring: false,
  onClose: jest.fn(),
  title: "Transfer admin",
  body: "Confirm the transfer.",
  confirmLabel: "Type CONFIRM to proceed",
  typeConfirmPlaceholder: "CONFIRM",
  cancelLabel: "Cancel",
  confirmButtonLabel: "Transfer",
};

describe("TransferAdminModal address validation", () => {
  it("accepts a valid Stellar public key: no error, submit enabled after typing CONFIRM", () => {
    const onConfirm = jest.fn();
    render(
      <TransferAdminModal {...baseProps} onConfirm={onConfirm} newAdminAddress={VALID_ADDRESS} />,
    );

    expect(screen.queryByText("Invalid address")).not.toBeInTheDocument();

    const confirmButton = screen.getByRole("button", { name: "Transfer" });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("CONFIRM"), { target: { value: "CONFIRM" } });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid address: shows an inline error and keeps submit disabled", () => {
    const onConfirm = jest.fn();
    render(
      <TransferAdminModal {...baseProps} onConfirm={onConfirm} newAdminAddress={INVALID_ADDRESS} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Invalid address");

    const confirmButton = screen.getByRole("button", { name: "Transfer" });
    fireEvent.change(screen.getByPlaceholderText("CONFIRM"), { target: { value: "CONFIRM" } });
    expect(confirmButton).toBeDisabled();

    fireEvent.click(confirmButton);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
