import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SocialLoginButtons from "@/components/SocialLoginButtons";

/**
 * #649 — The Google / X entry point for visitors without a Web3 wallet.
 * `useTranslations` is stubbed globally in setupTests to echo the key back.
 */
describe("SocialLoginButtons", () => {
  it("renders nothing when social login is not configured", () => {
    const { container } = render(<SocialLoginButtons available={false} onSelect={jest.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("offers both providers named in the issue", () => {
    render(<SocialLoginButtons available onSelect={jest.fn()} />);

    expect(screen.getByRole("button", { name: /continueWithGoogle/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continueWithX/ })).toBeInTheDocument();
  });

  it("passes the chosen provider through to the wallet", async () => {
    const onSelect = jest.fn().mockResolvedValue(undefined);
    render(<SocialLoginButtons available onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button", { name: /continueWithGoogle/ }));
    expect(onSelect).toHaveBeenCalledWith("google");

    await userEvent.click(screen.getByRole("button", { name: /continueWithX/ }));
    expect(onSelect).toHaveBeenCalledWith("twitter");
  });

  it("notifies the caller only once the connection settles", async () => {
    let resolveConnect: () => void = () => {};
    const onSelect = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConnect = resolve;
        }),
    );
    const onConnected = jest.fn();

    render(<SocialLoginButtons available onSelect={onSelect} onConnected={onConnected} />);
    await userEvent.click(screen.getByRole("button", { name: /continueWithGoogle/ }));

    // The surrounding modal must stay open while the popup is in flight.
    expect(onConnected).not.toHaveBeenCalled();

    resolveConnect();
    await screen.findByRole("button", { name: /continueWithGoogle/ });
    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  it("disables both providers while a connection is in progress", () => {
    render(<SocialLoginButtons available disabled onSelect={jest.fn()} />);

    expect(screen.getByRole("button", { name: /continueWithGoogle/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /continueWithX/ })).toBeDisabled();
  });
});
