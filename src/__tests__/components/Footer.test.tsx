import { render, screen } from "@testing-library/react";
import Footer from "@/components/Footer";
import { useContractVersion } from "@/hooks/useContractVersion";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

jest.mock("@/i18n/routing", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock("@/hooks/useContractVersion", () => ({
  useContractVersion: jest.fn(),
}));

const mockUseContractVersion = useContractVersion as jest.MockedFunction<typeof useContractVersion>;

function setVersionState(overrides: Partial<ReturnType<typeof useContractVersion>>) {
  mockUseContractVersion.mockReturnValue({
    version: null,
    expectedVersion: 1,
    isMismatch: false,
    isLoading: false,
    error: null,
    ...overrides,
  });
}

describe("Footer — contract version (issue #1211)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the resolved contract version", () => {
    setVersionState({ version: 3, isMismatch: false });
    render(<Footer />);

    const badge = screen.getByText("c3");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("title", "Contract Version");
  });

  it("does not render the version while the hook is still loading", () => {
    setVersionState({ version: null, isLoading: true });
    render(<Footer />);

    expect(screen.queryByText(/^c\d+$/)).not.toBeInTheDocument();
  });

  it("does not render the version when resolution failed", () => {
    setVersionState({ version: null, isLoading: false, error: "network down" });
    render(<Footer />);

    expect(screen.queryByText(/^c\d+$/)).not.toBeInTheDocument();
  });

  it("flags a version mismatch so support can spot the wrong deployment", () => {
    setVersionState({ version: 7, expectedVersion: 1, isMismatch: true });
    render(<Footer />);

    const badge = screen.getByText("c7");
    expect(badge).toHaveAttribute(
      "title",
      "Contract version mismatch! Unexpected behavior may occur.",
    );
  });
});
