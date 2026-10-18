import { render, screen, fireEvent } from "@testing-library/react";

jest.mock("@/lib/runtimeEnv", () => ({ IS_MOCK_MODE: true }));

describe("DevMockPanel — accessibility (issue #676)", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    Object.defineProperty(process.env, "NODE_ENV", { value: "development", configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(process.env, "NODE_ENV", { value: originalNodeEnv, configurable: true });
  });

  it("associates each campaign scenario label with its select", async () => {
    const { DevMockPanel } = await import("@/components/DevMockPanel");
    render(<DevMockPanel />);

    fireEvent.click(screen.getByRole("button", { name: /mock/i }));

    for (let id = 1; id <= 6; id++) {
      expect(screen.getByLabelText(`Campaign ${id}`)).toBeInTheDocument();
    }
  });
});
