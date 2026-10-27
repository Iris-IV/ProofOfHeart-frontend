import { render, screen, fireEvent } from "@testing-library/react";
import Navbar from "@/components/Navbar";

jest.mock("@/components/WalletContext", () => ({
  useWallet: () => ({
    publicKey: null,
    isWalletConnected: false,
    walletNetworkWarning: null,
    connectWallet: jest.fn(),
    disconnectWallet: jest.fn(),
    isLoading: false,
    socialProfile: null,
  }),
}));
jest.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: jest.fn() }),
}));
jest.mock("@/hooks/useAdmin", () => ({ useAdmin: () => ({ admin: null, isLoading: false }) }));
jest.mock("@/hooks/useCampaigns", () => ({ useCampaigns: () => ({ campaigns: [] }) }));
jest.mock("@/hooks/useSavedCampaigns", () => ({ useSavedCampaignsCount: () => 0 }));
jest.mock("@/hooks/useContractVersion", () => ({
  useContractVersion: () => ({ isMismatch: false, version: null, expectedVersion: null }),
}));
jest.mock("@/lib/runtimeEnv", () => ({ IS_MOCK_MODE: false }));
jest.mock("@/i18n/routing", () => ({
  Link: ({ children, href, ...rest }: any) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => "/",
}));
jest.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
jest.mock("./../../components/LanguageSwitcher", () => () => null);
jest.mock("./../../components/ContrastToggle", () => () => null);
jest.mock("./../../components/NotificationBell", () => () => null);
jest.mock("./../../components/NotificationSettings", () => () => null);

function touchStart(target: Element, x: number, y: number) {
  fireEvent.touchStart(target, { touches: [{ clientX: x, clientY: y }] });
}

function touchEnd(target: Element, x: number, y: number) {
  fireEvent.touchEnd(target, { changedTouches: [{ clientX: x, clientY: y }] });
}

describe("Navbar mobile menu", () => {
  it("renders the toggle button at 44px touch-target size", () => {
    render(<Navbar />);
    const toggle = screen.getByRole("button", { name: "Toggle menu" });
    expect(toggle.className).toContain("size-11");
  });

  it("closes the menu on an upward swipe and returns focus to the toggle", () => {
    render(<Navbar />);
    const toggle = screen.getByRole("button", { name: "Toggle menu" });
    fireEvent.click(toggle);
    const menu = document.getElementById("mobile-menu");
    expect(menu).not.toBeNull();

    touchStart(menu!, 100, 300);
    touchEnd(menu!, 100, 200);

    expect(document.getElementById("mobile-menu")).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });

  it("keeps the menu open for a short or downward swipe", () => {
    render(<Navbar />);
    fireEvent.click(screen.getByRole("button", { name: "Toggle menu" }));
    const menu = document.getElementById("mobile-menu")!;

    touchStart(menu, 100, 300);
    touchEnd(menu, 100, 320);
    touchStart(menu, 100, 300);
    touchEnd(menu, 100, 400);

    expect(document.getElementById("mobile-menu")).not.toBeNull();
  });
});
