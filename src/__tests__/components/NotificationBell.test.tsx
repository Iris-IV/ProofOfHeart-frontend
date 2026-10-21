import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotificationBell from "@/components/NotificationBell";
import type { AppNotification } from "@/lib/notifications";

const mockShowToast = jest.fn();
let mockNotifications: AppNotification[] = [];
let mockPublicKey: string | null = "GTEST";
let mockHasLoaded = true;

jest.mock("@/i18n/routing", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
jest.mock("@/components/WalletContext", () => ({
  useWallet: () => ({ publicKey: mockPublicKey }),
}));
jest.mock("@/components/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));
jest.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({
    notifications: mockNotifications,
    unreadCount: mockNotifications.filter((n) => !n.read).length,
    markAllRead: jest.fn(),
    markRead: jest.fn(),
    hasLoaded: mockHasLoaded,
  }),
}));

function notification(id: string, overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id,
    type: "campaign_funded",
    campaignId: 7,
    campaignTitle: "Campaign #7",
    message: `Campaign ${id} reached its goal.`,
    href: "/causes/7",
    timestamp: Date.now(),
    read: false,
    ...overrides,
  };
}

beforeEach(() => {
  mockShowToast.mockClear();
  mockNotifications = [];
  mockPublicKey = "GTEST";
  mockHasLoaded = true;
  localStorage.clear();
});

describe("NotificationBell", () => {
  it("shows an empty state message when there are no notifications", async () => {
    render(<NotificationBell />);
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByText("noNotifications")).toBeInTheDocument();
  });

  it("toasts notifications that arrive after the first load, not the backlog (#1347)", async () => {
    mockNotifications = [notification("old")];
    const { rerender } = render(<NotificationBell />);
    expect(mockShowToast).not.toHaveBeenCalled();

    mockNotifications = [notification("old"), notification("new")];
    rerender(<NotificationBell />);

    expect(mockShowToast).toHaveBeenCalledTimes(1);
    const [message, type, options] = mockShowToast.mock.calls[0] as [
      string,
      string,
      { action: { label: string; onClick: () => void } },
    ];
    expect(message).toContain("Campaign new reached its goal.");
    expect(type).toBe("success");
    expect(options.action.label).toBe("openNotifications");

    // The action opens the panel.
    act(() => options.action.onClick());
    expect(await screen.findByText("Campaign new reached its goal.")).toBeInTheDocument();
  });

  it("respects notification preferences", () => {
    localStorage.setItem(
      "notif_prefs_gtest",
      JSON.stringify({ frequency: "daily", channels: ["inApp"] }),
    );
    mockNotifications = [notification("old")];
    const { rerender } = render(<NotificationBell />);
    mockNotifications = [notification("old"), notification("new")];
    rerender(<NotificationBell />);
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it("starts over when the wallet changes", () => {
    mockNotifications = [notification("a")];
    const { rerender } = render(<NotificationBell />);

    mockPublicKey = "GOTHER";
    mockNotifications = [notification("b")];
    rerender(<NotificationBell />);
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it("toasts the first notification for a wallet whose feed loaded empty", () => {
    mockHasLoaded = false;
    const { rerender } = render(<NotificationBell />);
    mockHasLoaded = true;
    rerender(<NotificationBell />); // loaded, empty: baseline
    mockNotifications = [notification("first")];
    rerender(<NotificationBell />);
    expect(mockShowToast).toHaveBeenCalledTimes(1);
  });
});
